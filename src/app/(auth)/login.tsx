import { Text, View, StyleSheet } from "react-native";

// Figma: 로그인/회원가입
// 아이디/비밀번호 입력, 자동 로그인 체크, 회원가입 진입 링크.
export default function Login() {
  return (
    <View style={styles.container}>
      <Text>로그인/회원가입</Text>
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
