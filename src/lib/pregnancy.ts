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
