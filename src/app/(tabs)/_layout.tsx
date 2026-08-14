import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { CustomTabBar } from "@/components/tab-bar";

// 바텀탭 5개: 홈 / 분석 / 캘린더 / 기록 / 마이(프로필·설정)
// Figma 디자인의 둥근 상단 모서리 + 그림자 커스텀 탭바를 그대로 구현하기 위해
// OS 기본 탭바(NativeTabs) 대신 커스텀 tabBar를 사용한다.
//
// 탭바는 각 화면(예: analysis/report.tsx)이 아니라 이 네비게이터의 형제로
// 그려지기 때문에, 화면 안쪽에서만 그리는 핑크 그라데이션은 탭바 영역까지
// 닿지 않는다. 그 상태로 두면 탭바의 둥근 위쪽 모서리 바깥(모서리를 잘라낸
// 삼각형 부분)에 그라데이션이 아닌 다른 배경(기본 흰색 등)이 비쳐서 화면
// 하단과 탭바 경계가 어긋나 보인다. 여기서도 같은 그라데이션을 배경으로
// 깔아 탭바 뒤쪽까지 색이 이어지도록 한다.
export default function TabsLayout() {
  return (
    <>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
        sceneContainerStyle={{ backgroundColor: "transparent" }}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="analysis" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="record" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </>
  );
}
