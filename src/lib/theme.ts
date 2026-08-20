// src/lib/theme.ts
//
// Figma(SHINE_멋사해커톤)에서 뽑아온 디자인 토큰.
//
// 화면마다 색·그림자·자간을 따로 적다 보니 같은 카드인데 그림자가 다르고
// 같은 본문인데 자간이 없는 곳이 생겼다. Figma에 정의된 값은 전부 여기에 두고,
// 화면은 이 파일만 참조한다.
//
// Figma 원본 이름을 주석으로 남겨둔다 — 디자인이 바뀌었을 때 어느 변수를
// 고쳐야 하는지 바로 찾을 수 있어야 해서다.

export const colors = {
  /** Rectangle 21/500 — 본문·제목 */
  text: "#111111",
  /** Rectangle 21/300 — 보조 문구 */
  textSub: "#707070",
  /** Rectangle 21/200 — 안내·플레이스홀더 */
  textHint: "#A0A0A0",
  /** Rectangle 21/400 — 화면 소제목(지표명, 날짜, 섹션 제목) */
  textStrong: "#414141",
  /** 홈 대제목 (변수 없이 직접 지정된 값) */
  heading: "#4C4C4C",
  /** Rectangle 44747/500 — 로고 */
  brand: "#FF0A68",
  /** primary_pink — 버튼·선택 상태 */
  brandStrong: "#FA0C56",
  /** Rectangle 44747/100 — 카드 테두리 */
  brandSoft: "#FFCEE1",
  /** secondary_pink — 입력창·재료 타일 배경 */
  surfacePink: "#FFF0F6",
  /** white — 카드 배경 (순백이 아니라 살짝 분홍 기운) */
  surface: "#FFFCFD",
  /** 업로드 버튼처럼 Figma가 순백(#FFFFFF)을 쓰는 곳 */
  white: "#FFFFFF",
  border: "#CBCBCB",
  /** Rectangle 21/100 — 차트 격자선·기본 평균 점선 */
  line: "#CFCFCF",
  /** 표 구분선. Figma에서 변수에 묶이지 않은 raw 값이라 시안 기준 추정치다. */
  divider: "#EFEFEF",
  /** background3 — 화면 배경 그라데이션 */
  bgFrom: "#FFFCFD",
  bgTo: "#FFEBF3",
} as const;

export const font = {
  regular: "Pretendard-Regular",
  medium: "Pretendard-Medium",
  semiBold: "Pretendard-SemiBold",
  /** XX 로고 전용 */
  logo: "ZalandoSansExpanded_900Black",
} as const;

/**
 * Figma의 본문 자간은 예외 없이 폰트 크기의 -3%다.
 *   24 → -0.72 / 18 → -0.54 / 16 → -0.48 / 14 → -0.42 / 12 → -0.36
 * 숫자를 손으로 적으면 빠뜨리기 쉬워서 함수로 둔다.
 */
export function tracking(size: number): number {
  return Math.round(size * -3) / 100;
}

export const radius = {
  /** 업로드 카드·바텀시트·탭바 상단 */
  lg: 20,
  /** 일반 카드 */
  md: 14,
  /** 입력창·날짜 칸 */
  sm: 8,
  /** 작은 버튼(올리기) */
  xs: 6,
  /** 재료 타일 */
  tile: 4,
} as const;

/**
 * base shadow — Figma Effect(DROP_SHADOW, #0000000F, offset 0/3, blur 3, spread 0).
 * #0000000F = 알파 15/255 ≈ 0.06.
 *
 * 주의: borderRadius와 shadow를 같은 View에 주면 웹에서 그림자가 둥근 모서리를
 * 따라가지 않고 각지게 삐져나온다. overflow:"hidden"이 필요한 카드라면
 * 그림자 전용 바깥 View를 한 겹 두고 안쪽에서 자를 것(components/tab-bar.tsx 참고).
 */
export const cardShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
} as const;

/** 탭바 — Figma Effect(DROP_SHADOW, #00000033, offset 0/1, blur 4) */
export const tabBarShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 8,
} as const;

/**
 * 자주 쓰는 텍스트 세트.
 *
 * Figma가 단일 행 라벨에 붙여둔 line-height 34는 "17px 텍스트를 34px 박스에
 * 세로 중앙 정렬"하려고 넣은 값이라 그대로 쓰면 안 된다. 여기서는 실제 읽기에
 * 맞는 행간으로 바꾸되, 크기·굵기·자간·색은 Figma 그대로 옮겼다.
 */
export const type = {
  /** 홈 대제목 — 2줄, 줄당 32px */
  heading24: {
    fontFamily: font.semiBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.64,
    color: colors.heading,
  },
  /** 카드 안 큰 제목 (내 검사지 업로드) */
  title18: {
    fontFamily: font.semiBold,
    fontSize: 18,
    lineHeight: 34,
    letterSpacing: tracking(18),
    color: colors.text,
  },
  /** 카드 섹션 제목 (분석 / 추천 재료 / 캘린더) */
  section16: {
    fontFamily: font.medium,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: tracking(16),
    color: colors.text,
  },
  /** 본문 보조 (추천 질문, 언제든 간편하게) */
  body14: {
    fontFamily: font.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: tracking(14),
    color: colors.textSub,
  },
  /** 읽는 문장 (분석 요약 2줄) */
  read14: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: tracking(14),
    color: colors.text,
  },
  /** 작은 라벨 (탭바, 재료 이름, 날짜) */
  caption12: {
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: tracking(12),
    color: colors.textSub,
  },
} as const;

/**
 * 화면 상단 헤더 바.
 *
 * 화면마다 paddingTop이 6·10·12·14로 제각각이라, 탭을 옮기거나 상세로 들어갈 때
 * 제목이 위아래로 튀었다(기록 18px / 캘린더 24.5px 위치). 가장 여유 있는
 * 캘린더 화면을 기준으로 통일한다.
 *
 * minHeight가 필요한 이유: 제목만 있는 헤더(캘린더·기록)와 24px 아이콘이 들어가는
 * 헤더(분석·리포트·마이)는 내용 높이가 달라서, padding만 맞추면 3px씩 어긋난다.
 * 24px 아이콘이 들어갈 자리를 미리 잡아두면 어느 화면이든 같은 높이가 된다.
 *
 * paddingHorizontal과 justifyContent는 화면마다 달라서 여기에 넣지 않는다.
 */
export const headerBar = {
  minHeight: 38,
  paddingTop: 14,
  flexDirection: "row",
  alignItems: "center",
} as const;

/** 카드 사이 세로 간격 (Figma: 카드 bottom → 다음 카드 top = 12) */
export const CARD_GAP = 12;
/** 화면 좌우 여백 (Figma: 393 - 361 = 32 → 16씩) */
export const SCREEN_PADDING = 16;
