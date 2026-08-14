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
import type {
  CalendarMonthMarks,
  CalendarVisit,
  UserProfile,
  VisitDate,
  VisitDetail,
} from "./types";

/**
 * 화면이 쓰는 데이터 접근 계층.
 *
 * 지금은 목 데이터와 기기 저장소로 동작한다. 서버가 준비되면 각 함수 본문을
 * fetch 호출로 바꾸기만 하면 되고, 화면 코드는 건드릴 필요가 없다.
 *
 *   export async function getUserProfile(): Promise<UserProfile> {
 *     const res = await fetch(`${API_BASE_URL}/me`);
 *     return res.json();
 *   }
 */

const VISITS_KEY = "shine.calendar.visits.v1";

/** 마이 페이지 프로필 */
export async function getUserProfile(): Promise<UserProfile> {
  // TODO(api): GET /me
  return MOCK_PROFILE;
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
    questions: [],
  };
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
