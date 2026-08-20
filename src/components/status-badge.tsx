import { StyleSheet, Text, View } from "react-native";
import type { IndicatorStatus } from "@/lib/report";

// Figma(node 671:4531 Frame2085671652): 지표 판정 배지 3종 + 판정 불가(회색).
// 판정 엔진(lib/labs)이 붙으면서 상태가 6종으로 늘었지만, 색은 기존 4색을 그대로
// 쓰고 라벨만 세분화한다 — 서버에서 오는 옛 데이터(안심/주의/위험/미분류)와도
// 그대로 호환되도록 label을 안 주면 status가 곧 라벨이 된다.
const STATUS_COLORS: Record<IndicatorStatus, string> = {
  안심: "#CDFFD1",
  주의: "#FFEECD",
  위험: "#FFCDCD",
  미분류: "#EDEDED",
};

// 엔진 상태별 글자색 — "재검 필요"와 "확인 필요"를 눈으로 구분할 수 있게 한다.
const LABEL_COLORS: Record<string, string> = {
  "재검 필요": "#2A5D8F",
  "판정 보류": "#6B6B64",
  참고: "#6B6B64",
  미지원: "#6B6B64",
};

export function StatusBadge({
  status,
  label,
}: {
  status: IndicatorStatus;
  /** 엔진이 준 세분화 라벨("재검 필요", "판정 보류", "참고"). 없으면 status를 그대로 쓴다. */
  label?: string;
}) {
  const text = label ?? status;
  // "재검 필요"는 주의(노랑)가 아니라 파란 계열로 보여준다 — 나쁜 소식이 아니라
  // "아직 확정 아님"이라는 뜻이라, 노란 배지에 담으면 사용자가 불안해한다.
  const background =
    text === "재검 필요" ? "#DCE9F7" : STATUS_COLORS[status] ?? STATUS_COLORS.미분류;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.text, { color: LABEL_COLORS[text] ?? "#000" }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 50,
  },
  text: {
    fontFamily: "Pretendard-SemiBold",
    fontSize: 12,
  },
});
