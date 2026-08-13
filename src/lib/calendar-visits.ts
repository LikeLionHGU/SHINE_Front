import AsyncStorage from "@react-native-async-storage/async-storage";

export type CalendarVisit = {
  id: string;
  date: string;
  title: string;
  place: string;
  meridiem: "AM" | "PM";
  hour: number;
  minute: number;
  isHospital: boolean;
  questions: string[];
};

const STORAGE_KEY = "shine.calendar.visits.v1";

export const DEFAULT_CALENDAR_VISITS: CalendarVisit[] = [
  { id: "visit-2026-08-16", date: "26.08.16", title: "산부인과 진료", place: "OO 산부인과", meridiem: "PM", hour: 4, minute: 30, isHospital: true, questions: ["Ex) 당 수치가 올라가고 있는데 괜찮나요?", "Ex) 비타민 D 수치가 떨어지고 있는데 괜찮나요?"] },
  { id: "visit-2026-08-24", date: "26.08.24", title: "산부인과 진료", place: "OO 산부인과", meridiem: "PM", hour: 4, minute: 30, isHospital: true, questions: [] },
];

export function formatVisitTime(visit: Pick<CalendarVisit, "meridiem" | "hour" | "minute">) {
  return `${visit.meridiem === "AM" ? "오전" : "오후"} ${visit.hour}:${String(visit.minute).padStart(2, "0")}`;
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

export async function loadCalendarVisits() {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (!value) return DEFAULT_CALENDAR_VISITS;
  try {
    return sortVisits(JSON.parse(value) as CalendarVisit[]);
  } catch {
    return DEFAULT_CALENDAR_VISITS;
  }
}

export async function saveCalendarVisit(visit: CalendarVisit) {
  const visits = await loadCalendarVisits();
  const index = visits.findIndex((item) => item.id === visit.id);
  const next = index < 0 ? [...visits, visit] : visits.map((item) => item.id === visit.id ? visit : item);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
