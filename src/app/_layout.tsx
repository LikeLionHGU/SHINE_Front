import { useEffect } from "react";
import { Platform } from "react-native";
import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import Head from "expo-router/head";
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

  // 웹에서는 폰트 로딩을 기다리지 않는다. 여기서 null을 반환하면 "첫 렌더에는
  // 아무것도 없다가 나중에 화면이 생기는" 모양이 되는데, 정적 렌더링을 쓸 때는
  // 이게 서버 HTML과 어긋나 hydration이 깨진다(React #418). 폰트는 준비되는 대로
  // 자연스럽게 교체되므로 웹에서는 기다릴 이유가 없다.
  if (Platform.OS !== "web" && !fontsLoaded && !fontError) {
    return null;
  }

  return (
    // 화면마다 자체 배경(그라디언트/카드)을 그리므로 네비게이터 기본 배경은 투명으로 둔다.
    // 그래야 바텀시트 같은 투명 모달 뒤로 이전 화면이 비쳐 보인다.
    <ThemeProvider value={TRANSPARENT_THEME}>
      {/* 브라우저 탭에 뜨는 제목.
          expo-router가 <title>을 react-helmet으로 관리해서, 빌드 결과가
          <title data-rh="true"></title>처럼 **빈 채로** 나온다. 그래서 app.json의
          name만 바꿔서는 탭 제목이 안 바뀌고 브라우저가 주소를 대신 보여준다.
          여기서 앱 전체의 기본 제목을 정한다. 특정 화면만 다르게 하고 싶으면
          그 화면에서 같은 <Head>를 쓰면 덮어쓴다. */}
      <Head>
        <title>SHINE</title>
        <meta
          name="description"
          content="산전 검사 결과를 임신 주차 기준으로 쉽게 읽어주는 서비스"
        />
      </Head>
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
