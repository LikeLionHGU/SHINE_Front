import type { ViewStyle } from "react-native";

// 이 앱은 원래 iPhone(≈360~430px 폭) 기준 Figma 디자인으로 만들어졌다.
// 태블릿/폴더블 펼친 화면이나 웹 브라우저처럼 훨씬 넓은 화면에서 카드·리스트가
// 가장자리까지 끝없이 늘어나면 어색해 보이므로, 화면 콘텐츠 폭에 공통 상한선을
// 둔다. 일반 휴대폰 화면은 이 값보다 항상 좁아서 영향이 없다.
export const MAX_CONTENT_WIDTH = 480;

// ScrollView(또는 스크롤 없는 화면의 최상위 콘텐츠 View)의 style에 그대로
// 얹어 쓰는 공통 스타일. contentContainerStyle이 아니라 컴포넌트 자체의
// style에 적용해야 부모(SafeAreaView 등) 안에서 실제로 가운데 정렬된다.
export const centeredContentStyle: ViewStyle = {
  flex: 1,
  width: "100%",
  maxWidth: MAX_CONTENT_WIDTH,
  alignSelf: "center",
};

// 하단 시트/모달처럼 화면 하단에 붙는 요소에 적용하는 스타일. 폭이 넓은
// 화면에서는 가운데로 모이고, 좁은 화면에서는 기존처럼 꽉 채운다.
export const centeredSheetStyle: ViewStyle = {
  width: "100%",
  maxWidth: MAX_CONTENT_WIDTH,
  alignSelf: "center",
};

/**
 * 진료 일정 날짜("26.08.26")를 안내 문구용 짧은 라벨("08.26")로 바꾼다.
 * 이 앱의 날짜 포맷은 ISO가 아니라 YY.MM.DD라, ISO로 착각하고 자르면
 * "undefined.undefined"가 나온다(실제로 한 번 났던 버그).
 */
export function visitDateLabel(date: string): string {
  const parts = date.split(".");
  if (parts.length === 3) return `${parts[1]}.${parts[2]}`;
  return date;
}
