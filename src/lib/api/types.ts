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
