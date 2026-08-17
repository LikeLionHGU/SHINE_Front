import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { setAuthToken } from "./http";
import type {
  AuthResult,
  CalendarMonthMarks,
  CalendarVisit,
  LoginRequest,
  PregnancyInfo,
  SignupRequest,
  UserProfile,
  VisitDate,
  VisitDetail,
} from "./types";

/**
 * 화면이 쓰는 데이터 접근 계층.
 *
 * 지금은 목 데이터와 기기 저장소로 동작한다. 서버가 준비되면 각 함수 본문을
 * apiRequest 호출로 바꾸기만 하면 되고, 화면 코드는 건드릴 필요가 없다.
 *
 *   export async function getUserProfile(): Promise<UserProfile> {
 *     return apiRequest<UserProfile>("/me");
 *   }
 */

const VISITS_KEY = "shine.calendar.visits.v1";
const PREGNANCY_KEY = "shine.pregnancy.v1";
const QUESTIONS_KEY = "shine.calendar.questions.v1";

/* ---------------------------------------------------------------- 인증 */

/** 로그인. 성공하면 토큰을 저장해 이후 요청에 자동으로 붙는다. */
export async function login(request: LoginRequest): Promise<AuthResult> {
  // TODO(api): POST /auth/login
  //   const result = await apiRequest<AuthResult>("/auth/login", {
  //     method: "POST", body: request, skipAuth: true,
  //   });
  const result: AuthResult = { token: "mock-token", profile: MOCK_PROFILE };
  await setAuthToken(result.token);
  return result;
}

/** 회원가입. 로그인과 마찬가지로 토큰을 저장한다. */
export async function signup(request: SignupRequest): Promise<AuthResult> {
  // TODO(api): POST /auth/signup
  const result: AuthResult = {
    token: "mock-token",
    profile: {
      ...MOCK_PROFILE,
      name: request.name,
      phone: request.phone,
      email: request.email,
      guardianEmail: request.guardianEmail,
    },
  };
  await setAuthToken(result.token);
  // 목 구현에서는 가입 정보를 기기에 남겨 캘린더 주차 계산에 쓴다.
  await savePregnancyInfo(request.pregnancyWeek);
  return result;
}

/** 로그아웃. 저장된 토큰을 지운다. */
export async function logout(): Promise<void> {
  // TODO(api): POST /auth/logout
  await setAuthToken(null);
}

/* ------------------------------------------------------------ 사용자 정보 */

/** 마이 페이지 프로필 */
export async function getUserProfile(): Promise<UserProfile> {
  // TODO(api): GET /me
  return MOCK_PROFILE;
}

/* -------------------------------------------------------------- 임신 정보 */

/** 회원가입에서 받은 임신 주차 저장 */
export async function savePregnancyInfo(week: number): Promise<void> {
  // TODO(api): PUT /me/pregnancy
  const info: PregnancyInfo = { week, recordedAt: new Date().toISOString() };
  await AsyncStorage.setItem(PREGNANCY_KEY, JSON.stringify(info));
}

/** 캘린더 주차 계산의 기준이 되는 임신 정보 */
export async function getPregnancyInfo(): Promise<PregnancyInfo | null> {
  // TODO(api): GET /me/pregnancy
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
  // TODO(api): GET /me → guardianEmail
  return MOCK_PROFILE.guardianEmail;
}

/**
 * 캘린더 한 달치 검사 기록(원 표시·라벨).
 * 사용자가 등록한 일정은 getVisits로 따로 받아 화면에서 합친다.
 */
export async function getCalendarMonthMarks(
  year: number,
  month: number,
): Promise<CalendarMonthMarks> {
  // TODO(api): GET /calendar/marks?year=&month=
  const isMockMonth = year === MOCK_MARKS_YEAR && month === MOCK_MARKS_MONTH;
  return isMockMonth ? MOCK_MONTH_MARKS : { marks: {}, labels: {} };
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

/** 등록한 일정 전체 */
export async function getVisits(): Promise<CalendarVisit[]> {
  // TODO(api): GET /visits
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
  // TODO(api): GET /visits?date=
  const visits = await getVisits();
  return visits.filter((visit) => visit.date === date);
}

/** 일정 추가·수정 */
export async function saveVisit(visit: CalendarVisit): Promise<void> {
  // TODO(api): POST /visits (신규) 또는 PUT /visits/:id (수정)
  const visits = await getVisits();
  const exists = visits.some((item) => item.id === visit.id);
  const next = exists
    ? visits.map((item) => (item.id === visit.id ? visit : item))
    : [...visits, visit];
  await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(next));
}

/** 일정 삭제 */
export async function deleteVisit(id: string): Promise<void> {
  // TODO(api): DELETE /visits/:id
  const visits = await getVisits();
  const next = visits.filter((visit) => visit.id !== id);
  await AsyncStorage.setItem(VISITS_KEY, JSON.stringify(next));
}

/**
 * 특정 날짜의 진료 상세.
 *
 * 이전 검사지는 "다음 진료"까지만 존재한다. 그 뒤에 잡힌 일정은 아직 직전
 * 진료가 끝나지 않았으므로 검사지도 질문도 준비되지 않은 상태로 내려준다.
 */
export async function getVisitDetail(date: VisitDate): Promise<VisitDetail> {
  // TODO(api): GET /visits/:date/detail
  const visits = await getVisits();
  const today = formatVisitDate(new Date());
  const nextVisit = visits.find((visit) => visit.date >= today);
  const reportReady = !nextVisit || date <= nextVisit.date;

  if (!reportReady) return EMPTY_VISIT_DETAIL;

  return {
    todayReport: null,
    previousReport: MOCK_LATEST_REPORT,
    suggestedQuestions: MOCK_SUGGESTED_QUESTIONS,
    questions: await getVisitQuestions(date),
  };
}

/** 그 날 진료에서 직접 물어보려고 적어둔 질문 */
export async function getVisitQuestions(date: VisitDate): Promise<string[]> {
  // TODO(api): GET /visits/:date/questions
  const raw = await AsyncStorage.getItem(QUESTIONS_KEY);
  if (!raw) return [];
  try {
    const byDate = JSON.parse(raw) as Record<string, string[]>;
    return byDate[date] ?? [];
  } catch {
    return [];
  }
}

/** 질문 목록 저장 (빈 칸은 제외하고 보관한다) */
export async function saveVisitQuestions(
  date: VisitDate,
  questions: string[],
): Promise<void> {
  // TODO(api): PUT /visits/:date/questions
  const cleaned = questions.map((q) => q.trim()).filter(Boolean);
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
