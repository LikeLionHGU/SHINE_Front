import { Tabs } from "expo-router";
import { CustomTabBar } from "@/components/tab-bar";

// 바텀탭 5개: 홈 / 분석 / 캘린더 / 기록 / 마이(프로필·설정)
// Figma 디자인의 둥근 상단 모서리 + 그림자 커스텀 탭바를 그대로 구현하기 위해
// OS 기본 탭바(NativeTabs) 대신 커스텀 tabBar를 사용한다.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="analysis" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="record" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
