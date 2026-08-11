import { Stack } from "expo-router";

// (tabs) 위에 모달로 띄워지는 화면 그룹. 각 화면 상단 닫기(X) 버튼은
// router.back() 또는 router.dismiss()로 처리한다.
export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // 기본은 불투명. 시트류만 아래에서 투명하게 덮는다.
        contentStyle: { backgroundColor: "#FFFCFD" },
      }}
    >
      {/* 시트 자체가 올라오는 애니메이션을 직접 그리므로 화면 전환은 없앤다. */}
      <Stack.Screen
        name="calendar-time"
        options={{
          animation: "none",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Stack>
  );
}
