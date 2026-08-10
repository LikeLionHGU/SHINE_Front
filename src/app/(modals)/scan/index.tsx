import { Text, View, StyleSheet } from "react-native";

// Figma: 검사지 분석 (사진 촬영 / 사진 불러오기 선택)
// "산전 검사지를 업로드 해주세요" + 사진 촬영/사진 불러오기 버튼.
export default function ScanStart() {
  return (
    <View style={styles.container}>
      <Text>검사지 분석 - 업로드 방식 선택</Text>
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
