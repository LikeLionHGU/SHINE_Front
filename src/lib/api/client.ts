import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEMO_RECORDS,
  DEMO_TREND_INDICATORS,
  getTrendIndicator as getDemoTrendIndicator,
  type IndicatorStatus,
  type ParsedTestItem,
  type RecordEntry,
  type ReportFood,
  type TrendIndicator,
} from "@/lib/report";
import {
  EMPTY_VISIT_DETAIL,
  MOCK_LATEST_REPORT,
  MOCK_MARKS_MONTH,
  MOCK_MARKS_YEAR,
  MOCK_MONTH_MARKS,
  MOCK_PROFILE,
  MOCK_SUGGESTED_QUESTIONS,
  MOCK_VISITS,
} from "./mock-data";
import { API_BASE_URL, apiRequest, setAuthToken, withFallback } from "./http";
import type {
  AuthResult,
  Home,
  HomeQuestion,
  RecordDetail,
  Report,
  CalendarMonthMarks,
  CalendarVisit,
  LoginRequest,
  PregnancyInfo,
  ReportResult,
  ReportSubmission,
  SignupRequest,
  UserProfile,
  VisitDate,
  VisitDetail,
} from "./types";

/**
 * 화면이 쓰는 데이터 접근 계층.
 *
 * 실제 백엔드(API 명세서 v2)에 붙어 있다. EXPO_PUBLIC_API_BASE_URL이 비어 있거나
 * 요청이 실패하면 withFallback이 예전 목 데이터/기기 저장소로 되돌리므로,
 * 서버가 안 떠 있어도 화면은 그대로 동작한다(콘솔에 경고가 남는다).
 *
 * 엔드포인트는 명세서 12절 "APP — 프론트 호환 계층"을 쓴다. 응답이 이미
 * types.ts 모양(날짜 "26.08.24", 시간 meridiem/hour/minute)이라 변환이 거의 없다.
 */

const VISITS_KEY = "shine.calendar.visits.v1";
const PREGNANCY_KEY = "shine.pregnancy.v1";
const QUESTIONS_KEY = "shine.calendar.questions.v1";

/* ---------------------------------------------------------------- 인증 */

type TokenResponse = {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string;
  expiresIn?: number;
  /** 로그인 응답에 함께 오는 사용자 정보 (명세서 v3 1-3) */
  user?: { userId?: number; name?: string; pregnancyWeek?: number } | null;
};

/** 로그인. 성공하면 토큰을 저장해 이후 요청에 자동으로 붙는다. */
export async function login(request: LoginRequest): Promise<AuthResult> {
  const tokens = await apiRequest<TokenResponse>("/auth/login", {
    method: "POST",
    skipAuth: true,
    body: {
      loginId: request.accountId,
      password: request.password,
      // 자동 로그인일 때만 서버가 refreshToken을 발급한다.
      autoLogin: request.autoLogin ?? false,
    },
  });

  await setAuthToken(tokens.accessToken, tokens.refreshToken ?? null);
  // 캘린더 주차 계산이 /users/me 응답을 기다리지 않아도 되도록, 로그인 응답에
  // 담겨 오는 주수를 그대로 기기에 남겨둔다.
  if (typeof tokens.user?.pregnancyWeek === "number") {
    await cachePregnancyInfo(tokens.user.pregnancyWeek);
  }
  return { token: tokens.accessToken, profile: await getUserProfile() };
}

/** 회원가입. 가입 직후 바로 로그인해서 토큰까지 받아둔다. */
export async function signup(request: SignupRequest): Promise<AuthResult> {
  await apiRequest("/auth/signup", {
    method: "POST",
    skipAuth: true,
    body: {
      name: request.name,
      loginId: request.accountId,
      password: request.password,
      pregnancyWeek: request.pregnancyWeek,
      phoneNumber: request.phone,
      email: request.email,
      // 선택 항목이라 빈 문자열 대신 생략한다.
      ...(request.guardianEmail.trim() ? { guardianEmail: request.guardianEmail.trim() } : {}),
    },
  });

  // 가입 응답에는 토큰이 없다(명세서 2절) — 같은 자격증명으로 이어서 로그인한다.
  const result = await login({
    accountId: request.accountId,
    password: request.password,
    autoLogin: true,
  });

  // 캘린더 주차 계산이 서버 응답을 기다리지 않아도 되도록 기기에도 남겨둔다.
  await cachePregnancyInfo(request.pregnancyWeek);
  return result;
}

/** 로그아웃. 저장된 토큰을 지운다. */
export async function logout(): Promise<void> {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch (error) {
    // 서버 호출이 실패해도 기기에서는 반드시 로그아웃시킨다.
    console.warn("[api] 로그아웃 요청 실패:", error);
  }
  await setAuthToken(null);
}

/* ------------------------------------------------------------ 사용자 정보 */

/** 마이 페이지 프로필 — GET /api/v1/app/me */
export async function getUserProfile(): Promise<UserProfile> {
  return withFallback("getUserProfile", () => apiRequest<UserProfile>("/app/me"), () => MOCK_PROFILE);
}

/* -------------------------------------------------------------- 임신 정보 */

/** 임신 주차 저장 — PATCH /api/v1/users/me/pregnancy */
export async function savePregnancyInfo(week: number): Promise<void> {
  await cachePregnancyInfo(week);
  await withFallback(
    "savePregnancyInfo",
    async () => {
      await apiRequest("/users/me/pregnancy", { method: "PATCH", body: { pregnancyWeek: week } });
    },
    () => undefined,
  );
}

async function cachePregnancyInfo(week: number) {
  const info: PregnancyInfo = { week, recordedAt: new Date().toISOString() };
  await AsyncStorage.setItem(PREGNANCY_KEY, JSON.stringify(info));
}

/**
 * 캘린더 주차 계산의 기준이 되는 임신 정보 — GET /api/v1/users/me
 *
 * 서버는 최종월경일 하나만 저장하고 매번 "오늘 기준 주수"를 계산해서 준다.
 * 캘린더(lib/pregnancy.ts)는 "기준 시점 + 그때의 주차"로 다른 주를 역산하므로,
 * 받은 주차의 기준 시점은 오늘이 된다.
 */
export async function getPregnancyInfo(): Promise<PregnancyInfo | null> {
  return withFallback(
    "getPregnancyInfo",
    async () => {
      const me = await apiRequest<{ pregnancyWeek?: number }>("/users/me");
      if (typeof me?.pregnancyWeek !== "number") return readCachedPregnancyInfo();
      const info: PregnancyInfo = { week: me.pregnancyWeek, recordedAt: new Date().toISOString() };
      await AsyncStorage.setItem(PREGNANCY_KEY, JSON.stringify(info));
      return info;
    },
    readCachedPregnancyInfo,
  );
}

async function readCachedPregnancyInfo(): Promise<PregnancyInfo | null> {
  const raw = await AsyncStorage.getItem(PREGNANCY_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PregnancyInfo;
    if (typeof parsed?.week !== "number" || !parsed?.recordedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 보호자에게 공유할 때 쓰는 메일 주소 */
export async function getGuardianEmail(): Promise<string> {
  const profile = await getUserProfile();
  return profile.guardianEmail ?? "";
}

/* ---------------------------------------------------------------- 캘린더 */

/**
 * 캘린더 한 달치 검사 기록(원 표시·라벨) — GET /api/v1/app/calendar/marks
 *
 * 호출부는 Date.getMonth() 값(0~11)을 그대로 넘기지만 서버는 1~12를 받는다.
 */
export async function getCalendarMonthMarks(
  year: number,
  month: number,
): Promise<CalendarMonthMarks> {
  return withFallback(
    "getCalendarMonthMarks",
    async () => {
      const result = await apiRequest<Partial<CalendarMonthMarks>>(
        `/app/calendar/marks?year=${year}&month=${month + 1}`,
      );
      return { marks: result?.marks ?? {}, labels: result?.labels ?? {} };
    },
    () => {
      const isMockMonth = year === MOCK_MARKS_YEAR && month === MOCK_MARKS_MONTH;
      return isMockMonth ? MOCK_MONTH_MARKS : { marks: {}, labels: {} };
    },
  );
}

/** 목록은 항상 빠른 날짜·시간 순으로 보여준다. */
function sortVisits(visits: CalendarVisit[]) {
  return [...visits].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const toMinutes = (v: CalendarVisit) =>
      ((v.hour % 12) + (v.meridiem === "PM" ? 12 : 0)) * 60 + v.minute;
    return toMinutes(a) - toMinutes(b);
  });
}

/** 등록한 일정 전체 — GET /api/v1/app/visits */
export async function getVisits(): Promise<CalendarVisit[]> {
  return withFallback(
    "getVisits",
    async () => sortVisits((await apiRequest<CalendarVisit[]>("/app/visits")) ?? []),
    readStoredVisits,
  );
}

async function readStoredVisits(): Promise<CalendarVisit[]> {
  const stored = await AsyncStorage.getItem(VISITS_KEY);
  if (!stored) return MOCK_VISITS;
  try {
    return sortVisits(JSON.parse(stored) as CalendarVisit[]);
  } catch {
    return MOCK_VISITS;
  }
}

/** 하루에 등록된 일정 (시간 순) */
export async function getVisitsByDate(date: VisitDate): Promise<CalendarVisit[]> {
  const visits = await getVisits();
  return visits.filter((visit) => visit.date === date);
}

/**
 * 일정 추가·수정 — POST /api/v1/app/visits
 *
 * id는 서버가 발급한다. 새 일정이면 프론트가 만든 임시 id(`visit-<timestamp>`)는
 * 버려지고 서버 id가 담긴 일정이 돌아오므로, 저장 후에는 항상 getVisits로 다시 읽는다.
 */
export async function saveVisit(visit: CalendarVisit): Promise<CalendarVisit> {
  return withFallback(
    "saveVisit",
    async () => (await apiRequest<CalendarVisit>("/app/visits", { method: "POST", body: visit })) ?? visit,
    async () => {
      const visits = await readStoredVisits();
      const exists = visits.some((item) => item.id === visit.id);
      const next = exists
        ? visits.map((item) => (item.id === visit.id ? visit : item))
        : [...visits, visit];
      await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(next));
      return visit;
    },
  );
}

/** 일정 삭제 — DELETE /api/v1/app/visits/{id} */
export async function deleteVisit(id: string): Promise<void> {
  await withFallback(
    "deleteVisit",
    async () => {
      await apiRequest(`/app/visits/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async () => {
      const visits = await readStoredVisits();
      await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(visits.filter((v) => v.id !== id)));
    },
  );
}

/**
 * 특정 날짜의 진료 상세 — GET /api/v1/app/visits/{date}/detail
 * `date`는 "26.08.24" 형식이다.
 */
export async function getVisitDetail(date: VisitDate): Promise<VisitDetail> {
  return withFallback(
    "getVisitDetail",
    async () => {
      const detail = await apiRequest<VisitDetail>(`/app/visits/${encodeURIComponent(date)}/detail`);
      return {
        todayReport: withAbsoluteUrl(detail?.todayReport ?? null),
        previousReport: withAbsoluteUrl(detail?.previousReport ?? null),
        suggestedQuestions: detail?.suggestedQuestions ?? [],
        questions: detail?.questions ?? [],
      };
    },
    () => readStoredVisitDetail(date),
  );
}

/**
 * 검사지 참조를 화면이 쓸 수 있게 다듬는다.
 * - 이미지 경로가 `/api/v1/...` 상대 경로라 앞에 호스트를 붙이고
 * - 그 경로에 박혀 있는 검사지 id를 뽑아둔다. 이 id가 있어야 카드를 눌러
 *   분석 화면으로 넘어갈 수 있다. (응답에 id 필드가 따로 없다)
 */
function withAbsoluteUrl(report: Report | null): Report | null {
  if (!report) return null;
  // 명세서 예시는 "/api/v1/test-sheets/15"처럼 끝에 슬래시가 없다.
  // 이미지 경로("/api/v1/test-sheets/15/images/1")도 같은 정규식으로 잡힌다.
  const matched = report.url?.match(/test-sheets\/(\d+)/);
  const testSheetId = matched ? Number(matched[1]) : report.testSheetId;
  const url =
    report.url && !/^https?:\/\//.test(report.url) ? `${API_BASE_URL}${report.url}` : report.url;
  return { ...report, url, testSheetId };
}

async function readStoredVisitDetail(date: VisitDate): Promise<VisitDetail> {
  const visits = await readStoredVisits();
  const today = formatVisitDate(new Date());
  const nextVisit = visits.find((visit) => visit.date >= today);
  const reportReady = !nextVisit || date <= nextVisit.date;
  if (!reportReady) return EMPTY_VISIT_DETAIL;

  return {
    todayReport: null,
    previousReport: MOCK_LATEST_REPORT,
    suggestedQuestions: MOCK_SUGGESTED_QUESTIONS,
    questions: await readStoredQuestions(date),
  };
}

/** 그 날 진료에서 직접 물어보려고 적어둔 질문 */
export async function getVisitQuestions(date: VisitDate): Promise<string[]> {
  const detail = await getVisitDetail(date);
  return detail.questions;
}

/**
 * 질문 목록 저장 (빈 칸은 제외하고 보관한다).
 *
 * 호환 계층에는 질문 전용 엔드포인트가 없고, 일정에 붙은 `questions` 배열을
 * 통째로 교체하는 방식이다 — 그 날 일정을 찾아 같이 저장한다.
 * 일정이 없는 날은 서버에 붙일 곳이 없어 기기에만 남긴다.
 */
export async function saveVisitQuestions(date: VisitDate, questions: string[]): Promise<void> {
  const cleaned = questions.map((q) => q.trim()).filter(Boolean);
  await cacheQuestions(date, cleaned);

  await withFallback(
    "saveVisitQuestions",
    async () => {
      const dayVisits = await getVisitsByDate(date);
      const target = dayVisits.find((visit) => visit.isHospital) ?? dayVisits[0];
      if (!target) return;
      await apiRequest("/app/visits", { method: "POST", body: { ...target, questions: cleaned } });
    },
    () => undefined,
  );
}

async function cacheQuestions(date: VisitDate, cleaned: string[]) {
  const raw = await AsyncStorage.getItem(QUESTIONS_KEY);
  let byDate: Record<string, string[]> = {};
  try {
    byDate = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    byDate = {};
  }
  byDate[date] = cleaned;
  await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(byDate));
}

async function readStoredQuestions(date: VisitDate): Promise<string[]> {
  const raw = await AsyncStorage.getItem(QUESTIONS_KEY);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Record<string, string[]>)[date] ?? [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------ 기록 · 분석 */

/**
 * 기록 탭 타임라인 — GET /api/v1/app/records
 *
 * 서버가 최신순으로 주지만, 지난 날짜의 검사지를 나중에 올리면 업로드 순서로
 * 섞여 보이는 경우가 있어 화면에서 쓰기 전에 검사일 기준으로 다시 정렬한다.
 */
export async function getRecords(): Promise<RecordEntry[]> {
  return withFallback(
    "getRecords",
    async () => {
      const records = (await apiRequest<RecordEntry[]>("/app/records")) ?? [];
      return sortRecordsByDateDesc(
        records.map((record) => ({ ...record, week: sanitizeWeek(record.week) })),
      );
    },
    () => DEMO_RECORDS,
  );
}

/** "26.08.20" 형식은 문자열 비교만으로 날짜 순이 맞는다. 날짜가 같으면 최근 id 우선. */
function sortRecordsByDateDesc(records: RecordEntry[]): RecordEntry[] {
  return [...records].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return Number(b.id) - Number(a.id) || 0;
  });
}

/**
 * 서버가 계산해준 주차 문자열("28주차")을 그대로 쓰되, 임신 시작 이전 날짜의
 * 검사지에는 0 이하가 내려온다("-335주차", "0주차"). 화면에 그대로 찍으면
 * 사람이 읽을 수 없는 값이라 주차를 비워둔다.
 */
function sanitizeWeek(week: string | null | undefined): string {
  if (!week) return "";
  const value = Number(week.replace(/[^0-9-]/g, ""));
  return Number.isFinite(value) && value > 0 ? week : "";
}

/**
 * 지난 검사지 한 건 — GET /api/v1/test-sheets/{id}
 *
 * `/app/records`는 목록만 주기 때문에 상세는 이쪽을 쓴다. 응답이 `results[]`
 * (itemName·statusLabel·description) 구조라 화면이 쓰는 ParsedTestItem으로 옮긴다.
 */
export async function getRecordDetail(id: string): Promise<RecordDetail | null> {
  return withFallback(
    "getRecordDetail",
    async () => {
      const sheet = await apiRequest<TestSheetDetailResponse>(
        `/test-sheets/${encodeURIComponent(id)}`,
      );
      return sheet ? toRecordDetail(sheet) : null;
    },
    () => null,
  );
}

type TestResultResponse = {
  /** POST /reports 응답과 같은 모양일 때 쓰는 필드들 */
  name?: string | null;
  status?: string | null;
  definition?: string | null;
  verdict?: string | null;
  value?: string | null;
  itemName?: string | null;
  itemNameEn?: string | null;
  ocrLabel?: string | null;
  rawValue?: string | null;
  numberValue?: number | null;
  textValue?: string | null;
  unit?: string | null;
  normalMin?: number | null;
  normalMax?: number | null;
  statusLabel?: string | null;
  description?: string | null;
};

type TestSheetDetailResponse = {
  testSheetId: number;
  testDate?: string | null;
  pregnancyWeek?: number | null;
  week?: string | null;
  hospitalName?: string | null;
  /** 표준 REST 모양: { summaryForMom }. /reports 모양이면 그냥 문자열로 온다. */
  summary?: { summaryForMom?: string | null } | string | null;
  results?: TestResultResponse[] | null;
  /** /reports 응답과 같은 모양으로 돌려주는 서버도 있어서 둘 다 받는다. */
  items?: TestResultResponse[] | null;
  questions?: (string | { content?: string | null })[] | null;
  foods?: ReportFood[] | null;
};

const STATUS_LABELS: IndicatorStatus[] = ["안심", "주의", "위험"];

/**
 * 검사지 상세 응답을 화면 모양으로 옮긴다.
 *
 * 같은 검사지를 두 가지 모양으로 돌려주는 서버가 있어서(표준 REST의 `results[]`
 * 와 POST /reports 응답과 같은 `items[]`) 둘 다 받는다. 한쪽 모양만 보다가
 * 상태(status)를 못 읽어서 전부 "미분류"로 보이던 문제가 있었다.
 */
function toRecordDetail(sheet: TestSheetDetailResponse): RecordDetail {
  const rawItems = sheet.items?.length ? sheet.items : (sheet.results ?? []);
  const summary =
    typeof sheet.summary === "string" ? sheet.summary : (sheet.summary?.summaryForMom ?? "");
  const questions = (sheet.questions ?? [])
    .map((q) => (typeof q === "string" ? q : (q?.content ?? "")))
    .map((q) => q.trim())
    .filter(Boolean);

  return {
    testSheetId: sheet.testSheetId,
    testDate: sheet.testDate ?? "",
    // 서버가 "12주 3일"처럼 문자열로 주면 그대로 쓰고, 숫자만 주면 "N주차"로
    // 만든다. 둘 다 임신 시작 이전 날짜면 0 이하가 오므로 표시하지 않는다.
    week: sanitizeWeek(
      sheet.week?.trim() || (sheet.pregnancyWeek != null ? `${sheet.pregnancyWeek}주차` : ""),
    ),
    hospitalName: sheet.hospitalName ?? null,
    summary,
    items: rawItems.map(toParsedItem),
    questions,
    foods: (sheet.foods ?? []).filter((food) => !!food?.name),
  };
}

function toParsedItem(result: TestResultResponse): ParsedTestItem {
  // 상태 필드 이름이 응답 모양에 따라 statusLabel / status로 갈린다.
  const label = (result.statusLabel ?? result.status ?? "").trim();
  const name = result.name?.trim() || result.itemName?.trim() || result.ocrLabel?.trim() || "";
  const printed = result.ocrLabel?.trim() || result.itemNameEn?.trim() || "";
  return {
    // 매칭이 안 된 항목은 카탈로그 대표명이 없어 OCR 원문을 그대로 보여준다.
    name,
    // 대표명과 같은 글자면 두 번 보여줄 이유가 없다.
    originalName: printed && printed !== name ? printed : undefined,
    value: formatResultValue(result),
    // 상태 문자열이 없으면 서버가 판정하지 못한 항목(UNKNOWN)이다.
    status: STATUS_LABELS.includes(label as IndicatorStatus) ? (label as IndicatorStatus) : "미분류",
    definition: (result.definition ?? result.description ?? "").trim(),
    // verdict를 주는 응답이면 그대로 쓰고, 없으면 측정치와 참고치를 다시 적어준다
    // (진단처럼 읽힐 문장을 새로 만들지 않는다).
    verdict: result.verdict?.trim() || composeVerdict(result),
  };
}

/** "12.2 g/dL (11~15)" 형태로 합친다. */
function formatResultValue(result: TestResultResponse): string {
  // value를 통째로 주는 응답이면(POST /reports 모양) 그대로 쓴다.
  if (result.value?.trim()) return result.value.trim();
  const base =
    result.rawValue?.trim() ||
    (result.numberValue != null ? String(result.numberValue) : "") ||
    result.textValue?.trim() ||
    "";
  if (!base) return "";
  const withUnit = result.unit?.trim() ? `${base} ${result.unit.trim()}` : base;
  const hasRange = result.normalMin != null && result.normalMax != null;
  return hasRange ? `${withUnit} (${result.normalMin}~${result.normalMax})` : withUnit;
}

function composeVerdict(result: TestResultResponse): string {
  const value = formatResultValue(result);
  if (!value) return "";
  const hasRange = result.normalMin != null && result.normalMax != null;
  const range = hasRange ? ` 이 검사의 참고 범위는 ${result.normalMin}~${result.normalMax}예요.` : "";
  return `이번에 기록된 수치는 ${value}예요.${range}`;
}

/** 분석 탭 지표 목록 — GET /api/v1/app/trends */
export async function getTrends(): Promise<TrendIndicator[]> {
  return withFallback(
    "getTrends",
    async () => (await apiRequest<TrendIndicator[]>("/app/trends")) ?? [],
    () => DEMO_TREND_INDICATORS,
  );
}

/**
 * 지표 하나의 추이 상세 — GET /api/v1/app/trends/{id}
 * id는 검사 항목 코드 소문자다 (`hb`, `wbc`, `ferritin`, `vit_d`, `tsh`).
 */
export async function getTrend(id: string): Promise<TrendIndicator | null> {
  return withFallback(
    "getTrend",
    async () => (await apiRequest<TrendIndicator>(`/app/trends/${encodeURIComponent(id)}`)) ?? null,
    () => getDemoTrendIndicator(id),
  );
}

/* ---------------------------------------------------------------- 홈 */

/**
 * 홈 화면 전체 — GET /api/v1/home
 *
 * 인사말·최신 검사지 요약·추천 질문·추천 재료·주간 캘린더를 한 번에 준다.
 * 검사지가 없으면 latestSheet는 null이고 questions·nutritions는 빈 배열이다.
 */
export async function getHome(): Promise<Home | null> {
  return withFallback("getHome", async () => (await apiRequest<Home>("/home")) ?? null, () => null);
}

/**
 * 특정 검사지에 달린 질문 — GET /api/v1/questions?testSheetId=
 * 기록 탭에서 지난 검사지를 열었을 때 그때의 추천 질문을 보여주는 데 쓴다.
 */
export async function getQuestionsBySheet(testSheetId: string | number): Promise<HomeQuestion[]> {
  return withFallback(
    "getQuestionsBySheet",
    async () => {
      const result = await apiRequest<{ items?: HomeQuestion[] } | HomeQuestion[]>(
        `/questions?testSheetId=${encodeURIComponent(String(testSheetId))}`,
      );
      // 목록 응답이 { items: [...] } 인지 배열인지 명세가 갈려서 둘 다 받는다.
      if (Array.isArray(result)) return result;
      return result?.items ?? [];
    },
    () => [],
  );
}

/* ------------------------------------------------------------ 검사지 업로드 */

/**
 * 프론트 OCR·AI 결과를 서버에 보낸다 — POST /api/v1/reports
 *
 * 돌아오는 값은 서버가 **임신 기준으로 다시 판정한** 교정본이다.
 * (검사지에 인쇄된 참고치는 비임신 기준인 경우가 많아, 혈색소 11.5처럼
 * OCR이 "주의"로 본 값이 "안심"으로 바뀐다 — 명세서 6절.)
 * 화면에는 이 교정본을 보여준다.
 */
export async function submitReport(submission: ReportSubmission): Promise<ReportResult> {
  return apiRequest<ReportResult>("/reports", { method: "POST", body: submission });
}

/* ---------------------------------------------------------------- 유틸 */

/** Date → "YY.MM.DD" */
export function formatVisitDate(value: Date): VisitDate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(value.getFullYear() % 100)}.${pad(value.getMonth() + 1)}.${pad(value.getDate())}`;
}

/** 일정의 시간 표시 문자열 */
export function formatVisitTime(
  visit: Pick<CalendarVisit, "meridiem" | "hour" | "minute">,
) {
  const meridiem = visit.meridiem === "AM" ? "오전" : "오후";
  return `${meridiem} ${visit.hour}:${String(visit.minute).padStart(2, "0")}`;
}
