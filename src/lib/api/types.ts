import type { ParsedTestItem, ReportFood } from "@/lib/report";

/**
 * 서버와 주고받는 도메인 타입.
 * 화면은 이 타입에만 의존하므로, 목 데이터를 실제 API 응답으로 바꿔도
 * 화면 코드는 그대로 둘 수 있다.
 */

/** 날짜 문자열 형식: "YY.MM.DD" (예: "26.08.16") */
export type VisitDate = string;

/** 산전 검사지 업로드 완료 / 검사 일정만 잡힌 상태 */
export type DayMark = "uploaded" | "scheduled";

/** 회원가입에서 입력한 임신 주차와 입력 시점 */
export type PregnancyInfo = {
  week: number;
  /** ISO 날짜 문자열 */
  recordedAt: string;
};

/** 마이 페이지에 보여줄 사용자 정보 */
export type UserProfile = {
  name: string;
  /** 프로필 카드의 부제 (서비스 계정명) */
  accountName: string;
  phone: string;
  email: string;
  guardianEmail: string;
  /** 아직 등록하지 않았으면 null */
  extraEmail: string | null;
};

/**
 * 개인정보 수정에 보낼 값. 바꾸려는 칸만 채워 보낸다.
 * 빈 문자열은 "지운다"는 뜻이라 undefined와 구분된다.
 */
export type UserProfileUpdate = {
  name?: string;
  phone?: string;
  email?: string;
  guardianEmail?: string;
  extraEmail?: string;
};

/** 캘린더에 등록한 일정 하나 */
export type CalendarVisit = {
  id: string;
  date: VisitDate;
  title: string;
  place: string;
  meridiem: "AM" | "PM";
  hour: number;
  minute: number;
  /** 산부인과 일정이면 캘린더에 원으로, 아니면 제목 텍스트로 표시된다 */
  isHospital: boolean;
  questions: string[];
};

/** 캘린더 한 달치 표시 정보 (일정과 별개로 서버가 내려주는 검사 기록) */
export type CalendarMonthMarks = {
  /** 날짜(일) → 원 표시 종류 */
  marks: Record<number, DayMark>;
  /** 날짜(일) → 셀에 적을 짧은 라벨 */
  labels: Record<number, string>;
};

/** 검사지 한 건 */
export type Report = {
  /** 표시용 날짜 문자열 (예: "2026. 08. 15") */
  date: string;
  url?: string;
  /** 이 검사지를 분석 화면에서 열 때 쓰는 id. url에서 뽑아낸다. */
  testSheetId?: number;
};

/** 특정 날짜의 진료 상세 */
export type VisitDetail = {
  /** 당일 검사지. 진료 전이면 null */
  todayReport: Report | null;
  /** 직전 진료의 검사지. 아직 없으면 null */
  previousReport: Report | null;
  /** 검사 결과를 바탕으로 추천된 질문 */
  suggestedQuestions: string[];
  /** 사용자가 직접 적은 질문 */
  questions: string[];
};

/** 로그인 요청 */
export type LoginRequest = {
  accountId: string;
  password: string;
  /** 체크하면 refreshToken까지 받아 다음 실행에도 로그인이 유지된다 */
  autoLogin?: boolean;
};

/** 회원가입 요청 */
export type SignupRequest = {
  name: string;
  accountId: string;
  password: string;
  phone: string;
  email: string;
  /** 입력하지 않았으면 빈 문자열 */
  guardianEmail: string;
  /** 가입 시점의 임신 주차 */
  pregnancyWeek: number;
};

/** 로그인·회원가입 응답 */
export type AuthResult = {
  /** 이후 요청의 Authorization 헤더에 쓰이는 토큰 */
  token: string;
  profile: UserProfile;
};

/* ------------------------------------------------------------ 검사지 업로드 */

/**
 * 프론트가 OCR(lib/ocr.ts) + AI 요약(lib/insights.ts)으로 만들어 서버에 보내는 검사지.
 * POST /api/v1/reports 의 요청 본문이다.
 */
export type ReportSubmission = {
  /** "26.08.20" 또는 "2026-08-20". 없으면 서버가 오늘로 두고 확인 필요로 표시한다 */
  testDate?: string;
  items: ParsedTestItem[];
  summary?: string;
  questions?: string[];
  foods?: ReportFood[];
};

/**
 * 서버가 임신 기준으로 다시 판정하고 카탈로그 대표명·검수된 설명으로 교정해 돌려주는 검사지.
 * 요청과 같은 모양이되 값이 바뀌어 있다.
 */
export type ReportResult = {
  testSheetId: number;
  testDate: string;
  testDateConfirmed: boolean;
  /** "12주차" — 검사 당시 주수 스냅샷 */
  week: string;
  items: ParsedTestItem[];
  summary: string;
  questions: string[];
  foods: ReportFood[];
};

/**
 * 기록 탭에서 지난 검사지 한 건을 열었을 때 쓰는 모양.
 * 서버의 `GET /api/v1/test-sheets/{id}` 응답을 화면이 쓰는 형태로 옮긴 것이다.
 */
export type RecordDetail = {
  testSheetId: number;
  /** "2026-08-17" */
  testDate: string;
  /** "12주차" — 검사 당시 주수 스냅샷 */
  week: string;
  hospitalName: string | null;
  items: ParsedTestItem[];
  summary: string;
  /** 그때 저장해둔 추천 질문 (서버가 검사지와 함께 돌려주는 경우) */
  questions?: string[];
  /** 그때 저장해둔 추천 재료 (서버가 검사지와 함께 돌려주는 경우) */
  foods?: ReportFood[];
  /**
   * 등록할 때 함께 올린 검사지 원본 사진. 절대 URL로 바꿔서 담는다.
   * 이 경로도 인증이 필요해서 Authorization 헤더를 함께 보내야 열린다.
   */
  images?: { page: number; imageUrl: string }[];
};

/* ---------------------------------------------------------------- 홈 */

/** 홈에 띄우는 추천 질문. createdBy가 "AI"면 서버가 제안한 문구다. */
export type HomeQuestion = {
  questionId: number;
  content: string;
  createdBy: "SYSTEM" | "AI" | "USER";
};

/** 검사 결과에서 부족하게 나온 항목을 보완하는 추천 음식 */
export type HomeNutrition = {
  name: string;
  nutrient: string;
  reason: string;
  /** 이 음식을 추천하게 된 검사 항목 (예: "혈색소") */
  relatedItemName: string;
};

/** 홈 상단 주간 캘린더의 하루 */
export type HomeCalendarDay = {
  /** "2026-08-17" */
  date: string;
  day: number;
  /** "월" */
  dayOfWeek: string;
  isToday: boolean;
  hasAppointment: boolean;
  label: string | null;
};

/** 가장 최근에 분석된 검사지 요약 */
export type HomeLatestSheet = {
  testSheetId: number;
  testDate: string;
  displayDate: string;
  pregnancyWeek: number;
  summaryPreview: string;
  danger: number;
  caution: number;
  total: number;
};

/** 홈 화면 전체 — GET /api/v1/home 한 번으로 받는다 */
export type Home = {
  user: { name: string; pregnancyWeek: number; pregnancyDay: number; dueDate?: string } | null;
  greeting: string;
  /** 검사지를 한 번도 올리지 않았으면 null */
  latestSheet: HomeLatestSheet | null;
  questions: HomeQuestion[];
  /** 낮게 나온 항목이 있을 때만 채워진다 */
  nutritions: HomeNutrition[];
  weeklyCalendar: HomeCalendarDay[];
};
