import { useEffect } from "react";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
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
    // 화면마다 자체 배경(그라디언트/카드)을 그리므로 네비게이터 기본 배경은 투명으로 둔다.
    // 그래야 바텀시트 같은 투명 모달 뒤로 이전 화면이 비쳐 보인다.
    <ThemeProvider value={TRANSPARENT_THEME}>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="(modals)"
          options={{ presentation: "transparentModal", animation: "none" }}
        />
      </Stack>
    </ThemeProvider>
  );
}

const TRANSPARENT_THEME = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "transparent" },
};
