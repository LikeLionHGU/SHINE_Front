import { Text, View, StyleSheet } from "react-native";

// Figma: 검사지 분석 (종합 분석 결과, icon_close)
// 업로드한 검사지 이미지 + 종합 분석 요약 + 추천 재품.
// 우측 상단 icon_close 로 모달 닫기(router.dismiss()).
export default function ScanResult() {
  return (
    <View style={styles.container}>
      <Text>검사지 분석 - 종합 분석 결과</Text>
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
