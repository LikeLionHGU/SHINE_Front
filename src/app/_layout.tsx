import { Stack } from "expo-router";

// Root stack. Each group below owns its own navigation:
// - (auth): 로그인/회원가입 흐름
// - (tabs): 홈/분석/캘린더/기록/기타 바텀탭
// - (modals): 검사지 분석, 캘린더 시간/질문 등 모달로 띄우는 화면
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(modals)" options={{ presentation: "modal" }} />
    </Stack>
  );
}
