import { useState } from "react";
import { Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  CheckboxCheckedIcon,
  CheckboxUncheckedIcon,
  LockIcon,
  UserIcon,
} from "@/components/icons";

// Figma: 로그인/회원가입
// 아이디/비밀번호 입력, 자동 로그인 체크, 회원가입 진입 링크.
export default function Login() {
  const router = useRouter();
  const [autoLogin, setAutoLogin] = useState(false);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FFFCFD", "#FFF0F6"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.content}>
          <Text style={styles.title}>DOUBLE X</Text>

          <View style={[styles.field, styles.fieldSpacingTight]}>
            <UserIcon />
            <TextInput
              style={styles.input}
              placeholder="아이디"
              placeholderTextColor="#A0A0A0"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={[styles.field, styles.fieldSpacing]}>
            <LockIcon />
            <TextInput
              style={styles.input}
              placeholder="비밀번호"
              placeholderTextColor="#A0A0A0"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.row}>
            <Pressable
              style={styles.autoLogin}
              onPress={() => setAutoLogin((v) => !v)}
              hitSlop={8}
            >
              <View style={styles.checkboxOuter}>
                {autoLogin ? (
                  <CheckboxCheckedIcon size={20} />
                ) : (
                  <CheckboxUncheckedIcon size={20} />
                )}
              </View>
              <Text
                style={[
                  styles.autoLoginText,
                  { color: autoLogin ? "#707070" : "#929292" },
                ]}
              >
                자동 로그인
              </Text>
            </Pressable>

            <Pressable onPress={() => router.push("/signup")} hitSlop={8}>
              <Text style={styles.signupLink}>회원가입</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomArea}>
          <Pressable
            style={styles.loginButton}
            onPress={() => router.replace("/home")}
          >
            <Text style={styles.loginButtonText}>로그인</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  title: {
    textAlign: "center",
    color: "#FF0A68",
    fontSize: 24,
    fontFamily: "ZalandoSansExpanded_700Bold",
    lineHeight: 42,
    marginBottom: 16,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: "#FA0C56",
    backgroundColor: "#FFFCFD",
    paddingHorizontal: 17,
    gap: 14,
  },
  fieldSpacingTight: {
    marginBottom: 12,
  },
  fieldSpacing: {
    marginBottom: 16,
  },
  bottomArea: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  loginButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#FA0C56",
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: "#FFFDF9",
    fontSize: 20,
    fontFamily: "Pretendard-SemiBold",
    lineHeight: 26,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: "#111111",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  autoLogin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  checkboxOuter: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  autoLoginText: {
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    lineHeight: 18.2,
  },
  signupLink: {
    color: "#111111",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    lineHeight: 18.2,
  },
});
