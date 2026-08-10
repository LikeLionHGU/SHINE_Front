import { Text, View, StyleSheet } from "react-native";

// Figma: 회원가입 / 회원가입_입력 시 텍스트
// 이름, 임신 정보, 휴대폰 번호, 본인/보호자 이메일 입력 폼.
// 두 프레임은 입력 전/후 상태 차이일 뿐이라 화면 하나에서
// 폼 상태로 처리한다 (플레이스홀더 vs 입력값 텍스트).
export default function Signup() {
  return (
    <View style={styles.container}>
      <Text>회원가입</Text>
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
