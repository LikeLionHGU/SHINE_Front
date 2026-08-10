import { Text, View, StyleSheet } from "react-native";

// Figma: # 홈
// "지금 내 몸은 어떻게 변하고 있을까요?" 카드, 검사지 업로드 진입점,
// 분석 요약, 추천 제품 섹션.
export default function Home() {
  return (
    <View style={styles.container}>
      <Text>홈</Text>
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
