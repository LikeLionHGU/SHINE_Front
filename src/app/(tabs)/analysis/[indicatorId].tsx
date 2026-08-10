import { Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

// Figma: 분석_개별 지표
// 선택한 지표의 추이 그래프 + 종합 추이 상세 설명.
export default function AnalysisDetail() {
  const { indicatorId } = useLocalSearchParams<{ indicatorId: string }>();

  return (
    <View style={styles.container}>
      <Text>분석_개별 지표 ({indicatorId})</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
