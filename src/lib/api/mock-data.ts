import type {
  CalendarMonthMarks,
  CalendarVisit,
  UserProfile,
  VisitDetail,
} from "./types";

/**
 * API 연결 전까지 쓰는 목 데이터.
 * 실제 서버가 붙으면 이 파일은 지우고 client.ts의 fetch 구현만 남기면 된다.
 */

export const MOCK_PROFILE: UserProfile = {
  name: "김더블",
  accountName: "Double X",
  phone: "+821012345678",
  email: "DoubleX@gmail.com",
  guardianEmail: "XX@gmail.com",
  extraEmail: null,
};

/** 검사 기록이 있는 달: 2026년 8월 (month는 0-indexed) */
export const MOCK_MARKS_YEAR = 2026;
export const MOCK_MARKS_MONTH = 7;

export const MOCK_MONTH_MARKS: CalendarMonthMarks = {
  marks: {
    15: "uploaded",
    16: "scheduled",
    24: "scheduled",
  },
  labels: {
    18: "이비인후..",
  },
};

export const MOCK_VISITS: CalendarVisit[] = [
  {
    id: "visit-2026-08-16",
    date: "26.08.16",
    title: "산부인과 진료",
    place: "OO 산부인과",
    meridiem: "PM",
    hour: 4,
    minute: 30,
    isHospital: true,
    questions: [
      "Ex) 당 수치가 올라가고 있는데 괜찮나요?",
      "Ex) 비타민 D 수치가 떨어지고 있는데 괜찮나요?",
    ],
  },
  {
    id: "visit-2026-08-24",
    date: "26.08.24",
    title: "산부인과 진료",
    place: "OO 산부인과",
    meridiem: "PM",
    hour: 4,
    minute: 30,
    isHospital: true,
    questions: [],
  },
];

export const MOCK_SUGGESTED_QUESTIONS = [
  "Ex) 당 수치가 올라가고 있는데 괜찮나요?",
  "Ex) 비타민 D 수치가 떨어지고 있는데 괜찮나요?",
];

/** 가장 최근에 업로드된 검사지 */
export const MOCK_LATEST_REPORT = { date: "2026. 08. 15" };

/** 아직 검사지가 없는 일정에 쓰는 빈 상세 */
export const EMPTY_VISIT_DETAIL: VisitDetail = {
  todayReport: null,
  previousReport: null,
  suggestedQuestions: [],
  questions: [],
};
