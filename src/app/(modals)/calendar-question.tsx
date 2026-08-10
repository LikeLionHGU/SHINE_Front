import { Text, View, StyleSheet } from "react-native";

// Figma: 상세 질문 화면 (3개 프레임)
// "다음 진료 때 여쭤보세요" 추천 질문 + 당일 질문사항 작성/수정.
// 세 프레임은 목록 보기 / 드롭다운 편집 / 검사지 첨부 상태 차이이므로
// 화면 하나에서 상태로 처리한다.
export default function CalendarQuestion() {
  return (
    <View style={styles.container}>
      <Text>상세 질문 화면</Text>
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
