import { Text, View, StyleSheet } from "react-native";

// Figma: 캘린더_기본 / 캘린더_예정
// 월간 캘린더 + 예정된 일정 리스트. "오늘 예정된 일정이 있어요"
// 배너는 예정 일정 유무에 따른 같은 화면의 상태 차이.
export default function Calendar() {
  return (
    <View style={styles.container}>
      <Text>캘린더</Text>
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
