import { Text, View, StyleSheet } from "react-native";

// Figma: 기록
// "차곡차곡 쌓인 나의 건강 기록" - 지금까지의 분석/일정 히스토리.
export default function Record() {
  return (
    <View style={styles.container}>
      <Text>기록</Text>
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
