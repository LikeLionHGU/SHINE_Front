import { StyleSheet, Text, View } from "react-native";
import { normalizeIndicatorStatus, type IndicatorStatus } from "@/lib/report";

// Figma(node 671:4531 Frame2085671652): 지표 판정 배지 3종 + 판정 불가(회색).
//
// 판정 엔진(lib/labs)이 붙으면서 내부 상태는 7종으로 늘었지만, 칩은 4종으로 고정한다.
// 예전에는 엔진 라벨("재검 필요", "판정 보류", "중등도 빈혈", "기준 없음")을 그대로
// 칩에 찍었는데, 표를 훑을 때 항목마다 다른 글자가 나와서 무엇이 더 심각한지
// 한눈에 안 들어왔다. 세부 라벨은 상세 시트에서만 보여준다.
const STATUS_COLORS: Record<IndicatorStatus, string> = {
  안심: "#CDFFD1",
  주의: "#FFEECD",
  위험: "#FFCDCD",
  "확인 필요": "#EDEDED",
};

// "확인 필요"는 나쁜 소식이 아니라 "아직 판정 못 했다"는 뜻이라, 글자까지
// 새까맣게 두면 경고처럼 읽힌다. 회색 배경에 맞춰 글자도 한 톤 낮춘다.
const TEXT_COLORS: Record<IndicatorStatus, string> = {
  안심: "#000",
  주의: "#000",
  위험: "#000",
  "확인 필요": "#5A5A55",
};

export function StatusBadge({ status }: { status: IndicatorStatus }) {
  // 서버나 구버전 저장본이 "미분류" 같은 옛 값을 줄 수 있어 한 번 걸러준다.
  const s = normalizeIndicatorStatus(status);

  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[s] }]}>
      <Text style={[styles.text, { color: TEXT_COLORS[s] }]}>{s}</Text>
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
