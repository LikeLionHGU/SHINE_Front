import { StyleSheet, Text, View } from "react-native";
import type { IndicatorStatus } from "@/lib/report";

// Figma(node 671:4531 Frame2085671652): 지표 판정 배지 3종.
const STATUS_COLORS: Record<IndicatorStatus, string> = {
  안심: "#CDFFD1",
  주의: "#FFEECD",
  위험: "#FFCDCD",
};

export function StatusBadge({ status }: { status: IndicatorStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: STATUS_COLORS[status] }]}>
      <Text style={styles.text}>{status}</Text>
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
    color: "#000",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 12,
  },
});
