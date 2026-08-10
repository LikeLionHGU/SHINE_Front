import { Text, View, StyleSheet } from "react-native";

// Figma: 캘린더_시간
// 일정 추가/수정 시 시간을 고르는 바텀시트형 화면.
export default function CalendarTimePicker() {
  return (
    <View style={styles.container}>
      <Text>캘린더_시간</Text>
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
