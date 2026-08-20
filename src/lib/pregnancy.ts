import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PregnancyInfo } from "@/lib/api";

/**
 * 임신 주차 계산과, 서버로 갈 필요 없는 기기 설정.
 *
 * 임신 정보 자체(주차·기록 시점)는 서버 데이터라 @/lib/api 의
 * getPregnancyInfo / savePregnancyInfo 로 옮겼다.
 */

const SHARE_TIP_KEY = "calendar-share-tip-seen";

export const PREGNANCY_LAST_WEEK = 42;

/** 안내 말풍선은 앱을 처음 쓸 때 한 번만 노출한다 (기기별 설정). */
export async function hasSeenShareTip() {
  return (await AsyncStorage.getItem(SHARE_TIP_KEY)) === "1";
}

export async function markShareTipSeen() {
  await AsyncStorage.setItem(SHARE_TIP_KEY, "1");
}

export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 회원가입 때 받은 주차를 기준점 삼아, 임의의 주(일요일 시작)가 몇 주차인지 계산한다.
 * 예: 가입 시점이 8주차였다면 그 주가 8주차, 다음 주는 9주차.
 */
export function pregnancyWeekOf(weekStart: Date, info: PregnancyInfo) {
  const anchorWeekStart = startOfWeek(new Date(info.recordedAt));
  const days = Math.round(
    (weekStart.getTime() - anchorWeekStart.getTime()) / MS_PER_DAY,
  );
  return info.week + Math.round(days / 7);
}

/**
 * 앱이 쓰는 날짜 문자열을 Date로 바꾼다.
 * "26.08.20"(YY.MM.DD) · "2026-08-20" · "2026. 08. 20" 을 모두 받는다.
 */
export function parsePregnancyDate(
  raw: string | Date | null | undefined,
): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

  const parts = String(raw).match(/\d+/g);
  if (!parts || parts.length < 3) return null;
  let [year, month, day] = parts.slice(0, 3).map(Number);
  // "26.08.20"처럼 두 자리로 적힌 연도는 2000년대로 본다.
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * **그 날짜 시점의** 임신 주차.
 *
 * 검사받은 날이 오늘이 아닐 수 있다. 두 달 전 검사지를 지금 올리면 "지금 30주차"가
 * 아니라 "그때 22주차" 기준으로 봐야 판정도(삼분기별 기준) AI 설명도 맞는다.
 * 오늘 기준으로 쓰면 2분기 검사지에 3분기 기준을 들이대게 된다.
 *
 * 임신 정보를 아직 저장하지 않았으면 undefined — 이때 엔진은 주수와 무관한
 * 기준만 적용하고, 주수별 기준(헤모글로빈 11 / 10.5 / 11 등)은 건너뛴다.
 * 날짜를 알아보지 못하면 오늘 기준으로 떨어진다.
 */
export async function pregnancyWeekAt(
  date: string | Date | null | undefined,
): Promise<number | undefined> {
  try {
    const { getPregnancyInfo } = await import("@/lib/api");
    const info = await getPregnancyInfo();
    if (!info) return undefined;
    const target = parsePregnancyDate(date) ?? new Date();
    const week = pregnancyWeekOf(startOfWeek(target), info);
    return Number.isFinite(week) && week > 0 ? week : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 지금 시점의 임신 주차.
 * 검사일을 알 수 있는 자리에서는 pregnancyWeekAt(검사일)을 쓸 것.
 */
export async function currentPregnancyWeek(): Promise<number | undefined> {
  return pregnancyWeekAt(new Date());
}
