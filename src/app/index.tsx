import { useEffect } from "react";
import { Text, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

const SPLASH_DURATION_MS = 1800;

// Figma: 스플래시
// 앱 최초 진입 화면. 로고 노출 후 로그인 여부에 따라
// (auth)/login 또는 (tabs)/home 으로 라우팅한다.
export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/login");
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image
        source={require("@/assets/images/splash.png")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={styles.content}>
        <Image
          source={require("@/assets/images/logo.png")}
          style={styles.logo}
          contentFit="contain"
        />
        <Text style={styles.tagline}>
          BODY CHANGES.{"\n"}DATA SPEAKS.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 29,
  },
  logo: {
    width: 129,
    height: 64,
  },
  tagline: {
    width: 171,
    color: "#FFFCFD",
    fontSize: 16,
    fontFamily: "ZalandoSansExpanded_700Bold",
    lineHeight: 22,
    textAlign: "center",
  },
});
