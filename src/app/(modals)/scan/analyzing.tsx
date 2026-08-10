import { Text, View, StyleSheet } from "react-native";

// Figma: 검사지 분석 (분석 중)
// "업로드된 사진을 분석 중이니 잠시만 기다려주세요" 로딩 상태.
export default function ScanAnalyzing() {
  return (
    <View style={styles.container}>
      <Text>검사지 분석 - 분석 중</Text>
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
