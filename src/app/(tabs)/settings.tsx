import { Text, View, StyleSheet } from "react-native";

// Figma: 환경설정 (바텀탭 "기타")
// 프로필(이메일/보호자 이메일), 카메라 촬영 안내, 알림 설정,
// FAQ, 이용약관, 환경설정 메뉴.
export default function Settings() {
  return (
    <View style={styles.container}>
      <Text>환경설정</Text>
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
