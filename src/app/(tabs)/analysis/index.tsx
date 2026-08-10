import { Text, View, StyleSheet } from "react-native";

// Figma: 분석
// 날짜별 검사 지표(헤모글로빈, 혈당 등) 리스트. 항목 선택 시
// [indicatorId] 상세 화면으로 push.
export default function Analysis() {
  return (
    <View style={styles.container}>
      <Text>분석</Text>
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
