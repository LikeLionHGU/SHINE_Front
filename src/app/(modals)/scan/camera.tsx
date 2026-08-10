import { Text, View, StyleSheet } from "react-native";

// Figma: 검사지 분석 (사진 촬영)
// 카메라 촬영 화면. 촬영 완료 시 analyzing으로 이동.
export default function ScanCamera() {
  return (
    <View style={styles.container}>
      <Text>검사지 분석 - 사진 촬영</Text>
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
