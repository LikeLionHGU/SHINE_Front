import { Stack } from "expo-router";

// (tabs) 위에 모달로 띄워지는 화면 그룹. 각 화면 상단 닫기(X) 버튼은
// router.back() 또는 router.dismiss()로 처리한다.
export default function ModalsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
