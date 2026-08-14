import { ComponentType } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import {
  AnalysisTabIcon,
  CalendarTabIcon,
  HomeTabIcon,
  MyTabIcon,
  RecordTabIcon,
} from "@/components/icons";

const TAB_ICONS: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  home: HomeTabIcon,
  analysis: AnalysisTabIcon,
  calendar: CalendarTabIcon,
  record: RecordTabIcon,
  settings: MyTabIcon,
};

const TAB_LABELS: Record<string, string> = {
  home: "홈",
  analysis: "분석",
  calendar: "캘린더",
  record: "기록",
  settings: "마이",
};

// analysis(리스트→리포트→상세)와 calendar(리스트→날짜별 상세)처럼 안에
// 여러 화면이 쌓이는 탭들. 탭바에서 누르면 그 안쪽 어디에 있었든 항상
// 탭의 첫 화면(index)으로 돌아간다.
const NESTED_STACK_TABS = new Set(["analysis", "calendar"]);

// Figma: 바텀 탭바 (둥근 상단 모서리 + 그림자 카드형 커스텀 탭바)
// 사용처: src/app/(tabs)/_layout.tsx 에서 <Tabs tabBar={(props) => <CustomTabBar {...props} />}>
// 로 연결돼 있어서, (tabs)/ 아래 스크린들은 이 탭바를 자동으로 공유한다.
// 탭 추가/이름 변경 시 위 TAB_ICONS / TAB_LABELS 맵만 route 파일명 기준으로 고치면 됨.
export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const TabIcon = TAB_ICONS[route.name] ?? HomeTabIcon;
          const label = TAB_LABELS[route.name] ?? route.name;
          const color = focused ? "#111111" : "#A0A0A0";

          return (
            <Pressable
              key={route.key}
              style={styles.item}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;

                if (NESTED_STACK_TABS.has(route.name)) {
                  // 이미 그 탭 안(리포트/상세 등)에 있어도 항상 index로 이동.
                  navigation.navigate(route.name, { screen: "index" });
                  return;
                }

                if (!focused) {
                  navigation.navigate(route.name);
                }
              }}
            >
              <TabIcon size={26} color={color} />
              <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 30,
  },
  item: {
    width: 42,
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontFamily: "Pretendard-Medium",
    color: "#707070",
  },
  labelActive: {
    color: "#111111",
  },
});
