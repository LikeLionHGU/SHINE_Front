import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 서버 통신 공통 처리.
 *
 * .env 에 백엔드 주소를 넣으면 apiRequest가 그 주소로 요청한다.
 *   EXPO_PUBLIC_API_BASE_URL=https://api.example.com
 *
 * client.ts의 각 함수는 지금 목 데이터를 반환하고 있고,
 * 본문을 apiRequest 호출로 바꾸면 그대로 서버에 붙는다.
 */

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

/** 백엔드 주소가 설정돼 있는지. 없으면 목 데이터로 동작한다. */
export function isApiConfigured() {
  return API_BASE_URL.length > 0;
}

const TOKEN_KEY = "shine.auth.token";

/** 매 요청마다 AsyncStorage를 읽지 않도록 메모리에 들고 있는다. */
let authToken: string | null = null;

export async function loadAuthToken() {
  if (authToken !== null) return authToken;
  authToken = await AsyncStorage.getItem(TOKEN_KEY);
  return authToken;
}

export async function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

/** 서버가 실패를 응답했을 때 던지는 오류. 화면에서 status로 분기할 수 있다. */
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON으로 직렬화해서 본문에 넣는다 */
  body?: unknown;
  /** 인증 토큰을 붙이지 않는다 (로그인·회원가입 등) */
  skipAuth?: boolean;
  signal?: AbortSignal;
};

/**
 * JSON API 호출 한 번.
 * 성공하면 파싱된 응답을, 실패하면 ApiError를 던진다.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError(
      0,
      "EXPO_PUBLIC_API_BASE_URL이 설정되지 않았습니다. .env에 백엔드 주소를 추가하고 개발 서버를 재시작해주세요.",
    );
  }

  const { method = "GET", body, skipAuth, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!skipAuth) {
    const token = await loadAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  // 본문이 없는 응답(204 등)도 있으므로 먼저 텍스트로 읽는다.
  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const message =
      (typeof parsed === "object" && parsed !== null && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : null) ?? `요청에 실패했어요 (${response.status})`;
    throw new ApiError(response.status, message, parsed);
  }

  return parsed as T;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
