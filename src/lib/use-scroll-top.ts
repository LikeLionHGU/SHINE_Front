import { useCallback, useRef } from "react";
import { Platform, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";

/**
 * 화면에 들어올 때마다 스크롤을 맨 위로 되돌린다.
 *
 * 왜 필요한가: 화면을 옮겨도 스택에 남은 화면은 스크롤 위치를 그대로 기억한다.
 * 그래서 목록을 한참 내려본 뒤 상세로 들어갔다 돌아오거나, 탭을 오갈 때
 * 새 화면이 중간부터 보이는 일이 생긴다. 웹에서 특히 눈에 띈다.
 *
 * 쓰는 법: 돌려받은 ref를 그 화면의 **바깥 ScrollView**에 걸어둔다.
 *
 *   const scrollRef = useScrollToTop();
 *   <ScrollView ref={scrollRef} ...>
 *
 * 주의: 시간 선택 휠처럼 특정 위치에 맞춰둬야 하는 스크롤에는 쓰지 말 것
 * (calendar-time.tsx의 WheelColumn, scan/date-confirm.tsx의 연도 목록).
 */
export function useScrollToTop() {
  const ref = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      // animated: false — 화면이 뜬 뒤 위로 올라가는 모습이 보이면 안 된다.
      ref.current?.scrollTo({ y: 0, animated: false });

      // ScrollView가 아니라 문서 자체가 내려가 있는 경우(웹)도 함께 되돌린다.
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.scrollTo(0, 0);
      }
    }, []),
  );

  return ref;
}
