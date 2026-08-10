import { useEffect } from "react";
import { Stack } from "expo-router";
import {
  useFonts,
  ZalandoSansExpanded_700Bold,
  ZalandoSansExpanded_900Black,
} from "@expo-google-fonts/zalando-sans-expanded";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

// Root stack. Each group below owns its own navigation:
// - (auth): 로그인/회원가입 흐름
// - (tabs): 홈/분석/캘린더/기록/기타 바텀탭
// - (modals): 검사지 분석, 캘린더 시간/질문 등 모달로 띄우는 화면
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ZalandoSansExpanded_700Bold,
    ZalandoSansExpanded_900Black,
    "Pretendard-Regular": require("@/assets/fonts/Pretendard-Regular.otf"),
    "Pretendard-Medium": require("@/assets/fonts/Pretendard-Medium.otf"),
    "Pretendard-SemiBold": require("@/assets/fonts/Pretendard-SemiBold.otf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(modals)" options={{ presentation: "modal" }} />
    </Stack>
  );
}
