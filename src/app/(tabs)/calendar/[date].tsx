import { Text, View, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";

// Figma: 캘린더_일정
// 선택한 날짜(예: 08.26)의 일정 리스트 + 추가 버튼.
export default function CalendarDay() {
  const { date } = useLocalSearchParams<{ date: string }>();

  return (
    <View style={styles.container}>
      <Text>캘린더_일정 ({date})</Text>
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
