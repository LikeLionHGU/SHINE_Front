import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 서버 통신 공통 처리.
 *
 * .env 에 백엔드 주소를 넣으면 apiRequest가 그 주소로 요청한다.
 *   EXPO_PUBLIC_API_BASE_URL=https://1.201.117.27.nip.io
 *
 * 주소가 비어 있으면 client.ts의 각 함수가 목 데이터로 되돌아간다(withFallback).
 */

/** 끝에 슬래시가 붙어 있어도(`.../8080/`) 경로가 `//api/v1`이 되지 않도록 잘라낸다. */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");

/** 모든 엔드포인트가 공유하는 접두사. apiRequest가 자동으로 붙인다. */
export const API_PREFIX = "/api/v1";

/** 백엔드 주소가 설정돼 있는지. 없으면 목 데이터로 동작한다. */
export function isApiConfigured() {
  return API_BASE_URL.length > 0;
}

// 주소가 비면 모든 화면이 조용히 목 데이터로 동작해서 "서버가 붙은 것처럼" 보인다.
// 특히 EAS 빌드는 .env가 .gitignore에 있어 번들에 안 들어가므로, 앱에서만 목으로
// 돌아가는 사고가 나기 쉽다. 앱 시작 시 한 번 크게 알린다.
if (!isApiConfigured()) {
  console.warn(
    "[api] EXPO_PUBLIC_API_BASE_URL이 비어 있어 모든 데이터가 목으로 동작합니다.\n" +
      "  · 로컬: .env 확인 후 `npx expo start -c`로 재시작\n" +
      "  · EAS 빌드: .env는 번들에 들어가지 않습니다. eas.json의 build.<profile>.env를 확인하세요.",
  );
}

const ACCESS_TOKEN_KEY = "shine.auth.token";
const REFRESH_TOKEN_KEY = "shine.auth.refreshToken";

/** 매 요청마다 AsyncStorage를 읽지 않도록 메모리에 들고 있는다. */
let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokensLoaded = false;

async function ensureTokensLoaded() {
  if (tokensLoaded) return;
  const [access, refresh] = await Promise.all([
    AsyncStorage.getItem(ACCESS_TOKEN_KEY),
    AsyncStorage.getItem(REFRESH_TOKEN_KEY),
  ]);
  accessToken = access;
  refreshToken = refresh;
  tokensLoaded = true;
}

export async function loadAuthToken() {
  await ensureTokensLoaded();
  return accessToken;
}

/**
 * 토큰 저장. refresh를 생략하면 기존 refreshToken을 그대로 두고,
 * token에 null을 주면 둘 다 지운다(로그아웃).
 */
export async function setAuthToken(token: string | null, refresh?: string | null) {
  tokensLoaded = true;
  accessToken = token;

  if (token === null) {
    refreshToken = null;
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
    return;
  }

  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);

  if (refresh === undefined) return;
  refreshToken = refresh;
  if (refresh) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  else await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** 서버가 실패를 응답했을 때 던지는 오류. 화면에서 status/code로 분기할 수 있다. */
export class ApiError extends Error {
  status: number;
  /** 서버 에러 코드 (INVALID_INPUT, LOGIN_FAILED, ...) */
  code: string | null;
  body: unknown;

  constructor(status: number, message: string, code: string | null = null, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON으로 직렬화해서 본문에 넣는다 */
  body?: unknown;
  /** 인증 토큰을 붙이지 않는다 (로그인·회원가입·재발급) */
  skipAuth?: boolean;
  signal?: AbortSignal;
  /** 내부용 — 401 재발급 후 재시도인지 (무한 루프 방지) */
  _retried?: boolean;
};

/**
 * 서버 공통 응답 껍데기. `{ success, code, message, data }`.
 * /app/** 호환 계층처럼 껍데기 없이 바로 배열/객체가 오는 경우도 있어서
 * 모양을 보고 있을 때만 벗긴다.
 */
type ApiEnvelope = { success: boolean; code?: string; message?: string; data?: unknown };

function isEnvelope(value: unknown): value is ApiEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as ApiEnvelope).success === "boolean"
  );
}

/** 검증 실패 응답(`data.errors`)에서 첫 번째 사유를 뽑아 사용자에게 보여준다. */
function firstFieldError(data: unknown): string | null {
  const errors = (data as { errors?: unknown })?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const reason = (errors[0] as { reason?: unknown })?.reason;
  return typeof reason === "string" && reason.trim() ? reason.trim() : null;
}

/**
 * refreshToken으로 accessToken을 다시 받는다. 여러 요청이 동시에 401이 나도 한 번만 돈다.
 *
 * 명세서 v3 기준 accessToken은 시연 기간 동안 24시간, refreshToken은 14일이다.
 * 만료되면 401 + TOKEN_EXPIRED가 오고, 그때 이 함수가 돌아 토큰을 갱신한다.
 * 서버가 refreshToken도 새로 주면(rotation) 반드시 새 값으로 덮어써야 다음 갱신이 된다.
 *
 * 주의: 로그인할 때 autoLogin=false면 서버가 refreshToken을 안 준다 → 갱신할 수단이
 * 없어 30분 뒤 전부 401이 된다. 로그인 화면의 "자동 로그인"을 켠 채로 테스트할 것.
 */
let reissuing: Promise<boolean> | null = null;

async function reissueTokens(): Promise<boolean> {
  await ensureTokensLoaded();
  if (!refreshToken) return false;
  if (reissuing) return reissuing;

  reissuing = (async () => {
    try {
      // 서버가 accessToken/token 중 어느 이름으로 주든 받도록 둘 다 본다.
      const result = await apiRequest<{
        accessToken?: string;
        token?: string;
        refreshToken?: string | null;
      }>("/auth/reissue", { method: "POST", body: { refreshToken }, skipAuth: true, _retried: true });
      const nextAccessToken = result?.accessToken ?? result?.token;
      if (!nextAccessToken) return false;
      await setAuthToken(nextAccessToken, result.refreshToken ?? refreshToken);
      return true;
    } catch {
      // Rotation 재사용 감지 등으로 재발급이 막히면 토큰을 비워 로그인 화면으로 보낸다.
      await setAuthToken(null);
      return false;
    } finally {
      reissuing = null;
    }
  })();

  return reissuing;
}

/**
 * JSON API 호출 한 번.
 * path는 `/api/v1` 뒤의 경로만 준다 (예: `/app/visits`).
 * 성공하면 껍데기를 벗긴 `data`를, 실패하면 ApiError를 던진다.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError(
      0,
      "EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다. .env에 백엔드 주소를 추가하고 개발 서버를 재시작해주세요.",
    );
  }

  const { method = "GET", body, skipAuth, signal, _retried } = options;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!skipAuth) {
    const token = await loadAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  // 본문이 없는 응답(204 등)도 있으므로 먼저 텍스트로 읽는다.
  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;
  const envelope = isEnvelope(parsed) ? parsed : null;
  const payload = envelope ? (envelope.data ?? null) : parsed;

  // HTTP는 200인데 껍데기 안에서 실패인 경우도 실패로 취급한다.
  const failed = !response.ok || envelope?.success === false;

  if (failed) {
    // accessToken 만료(401 + TOKEN_EXPIRED)면 한 번만 재발급하고 같은 요청을 다시 보낸다.
    // 코드 이름이 서버마다 조금씩 달라서, refreshToken 재사용 감지(더 이상 갱신 불가)만
    // 빼고 401은 전부 갱신 대상으로 본다.
    const unrecoverable = ["REFRESH_TOKEN_REUSED", "REFRESH_TOKEN_INVALID", "LOGIN_FAILED"];
    const expired = response.status === 401 && !unrecoverable.includes(envelope?.code ?? "");
    if (expired && !skipAuth && !_retried && (await reissueTokens())) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }

    const message =
      firstFieldError(payload) ??
      (typeof envelope?.message === "string" && envelope.message.trim() ? envelope.message : null) ??
      `요청에 실패했어요 (${response.status})`;

    throw new ApiError(response.status, message, envelope?.code ?? null, parsed);
  }

  return payload as T;
}

/**
 * 서버가 안 떠 있거나 요청이 실패해도 화면이 비지 않도록 목 데이터로 되돌린다.
 * 실패는 콘솔 경고로 남기니, 연동이 안 될 때는 로그를 먼저 확인할 것.
 */
export async function withFallback<T>(
  label: string,
  run: () => Promise<T>,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (!isApiConfigured()) return fallback();
  try {
    return await run();
  } catch (error) {
    console.warn(`[api] ${label} 실패 — 로컬 데이터로 대체합니다:`, error);
    return fallback();
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
