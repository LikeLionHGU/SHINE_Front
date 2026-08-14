import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "shine.report.last.v1";

export type LastReport = {
  /** 업로드한 검사지 이미지의 로컬 URI */
  uri: string;
  /** ISO 날짜 문자열 */
  uploadedAt: string;
  /** OCR로 읽어낸 검사항목/수치/상태 목록. 파싱 실패 시 비어있을 수 있다. */
  items?: ParsedTestItem[];
};

export async function saveLastReport(uri: string, items?: ParsedTestItem[]) {
  const report: LastReport = { uri, uploadedAt: new Date().toISOString(), items };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  return report;
}

export async function loadLastReport(): Promise<LastReport | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastReport;
    if (typeof parsed?.uri !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

// 실제 DUR/건강기능식품 API·OCR 연동 전까지 쓰는 자리표시 분석 결과.
// Figma(node 671:4356/671:4386 검사지 분석-번역) 문구를 그대로 옮겨왔다.
export const DEMO_SUMMARY =
  "관련 결과 전체적으로 안정적인 수치를 띄며 B형·C형 간염, 매독, HIV 검사에서 모두 이상이 발견되지 않았어요.\n지금 시기에는 비타민 D를 충분히 보충해주는 것이 좋아요.";

export type IndicatorStatus = "안심" | "주의" | "위험";

// lib/ocr.ts(OpenAI Vision)가 검사지 사진에서 실제로 읽어낸 한 줄.
export type ParsedTestItem = {
  /** 검사항목 (예: "헤모글로빈") */
  name: string;
  /** 수치 (참고치가 함께 적혀 있으면 원문 그대로, 예: "12.2 g/dL (11~15)") */
  value: string;
  /** OCR 모델이 판단한 상태 */
  status: IndicatorStatus;
};

export type IndicatorDetail = {
  id: string;
  title: string;
  status: IndicatorStatus;
  definition: string;
  verdict: string;
  /** 리포트 이미지 위 마커 위치 (이미지 폭/높이 대비 비율) */
  markerPosition: { xRatio: number; yRatio: number };
};

export const DEMO_INDICATORS: Record<string, IndicatorDetail> = {
  hemoglobin: {
    id: "hemoglobin",
    title: "헤모글로빈",
    status: "안심",
    definition: "헤모글로빈은 혈액 속에서 산소를 몸 곳곳으로 운반해주는 단백질이에요.",
    verdict: "헤모글로빈 수치가 12.2 g/dL로 정상 범위에 있어요.\n현재 검사 결과에서는 빈혈을 의심할 만한 수치가 확인되지 않았어요!",
    markerPosition: { xRatio: 0.335, yRatio: 0.297 },
  },
};

// ---- 분석 탭: 지표 리스트 + 개별 추이 상세 (node 671:3093, 671:4538) ----
// 실제 검사 지표 추출 API 연동 전까지 쓰는 자리표시 데이터. hemoglobin-trend는
// Figma 상세 화면(671:4538)의 수치를 그대로 옮겼고, 나머지는 리스트 레이아웃을
// 채우기 위한 데모 항목이다.

export type TrendPoint = { date: string; value: number };

export type TrendIndicator = {
  id: string;
  title: string;
  status: IndicatorStatus;
  unit: string;
  definition: string;
  /** "종합 추이 상세 설명" 카드 본문 */
  trendSummary: string;
  /** 차트 y축 하단/상단 기준값 (이 범위로 정규화해서 그린다) */
  range: [number, number];
  /** y축 라벨, 위→아래 순서 */
  zoneLabels: [string, string, string];
  history: TrendPoint[];
};

export const DEMO_TREND_INDICATORS: TrendIndicator[] = [
  {
    id: "hemoglobin-trend",
    title: "혈색소 (헤모글로빈)",
    status: "위험",
    unit: "g/dL",
    definition: "헤모글로빈은 혈액 속에서 산소를 몸 곳곳으로 운반해주는 단백질이에요.",
    trendSummary:
      "헤모글로빈은 임신이 진행되면서 평균적으로 11~12 g/dL 정도로 나타나요.\n임신 중에는 혈액량이 늘어나면서 수치가 조금 낮아질 수 있어요.\n최근 4번의 검사에서 수치가 오르내리는 모습이 보여요.\n자연스러운 변화일 수도 있지만, 변화 폭이 괜찮은지\n의사 선생님과 함께 확인해보세요.",
    range: [9, 16],
    zoneLabels: ["높음", "안정", "낮음"],
    history: [
      { date: "4월 20일", value: 13.6 },
      { date: "5월 26일", value: 13.6 },
      { date: "7월 16일", value: 10.8 },
      { date: "8월 1일", value: 15.0 },
    ],
  },
  {
    id: "urine-protein",
    title: "요단백",
    status: "위험",
    unit: "mg/dL",
    definition: "요단백은 소변 속 단백질 수치로, 임신 중 신장 기능과 임신중독증 위험을 살피는 지표예요.",
    trendSummary:
      "요단백은 보통 음성(-)이 정상이에요.\n최근 검사에서 수치가 조금씩 올라가는 추세가 보여요.\n혈압, 부종과 함께 지켜봐야 하는 지표라 다음 진료 때\n꼭 함께 확인해보세요.",
    range: [0, 3],
    zoneLabels: ["높음", "안정", "낮음"],
    history: [
      { date: "4월 20일", value: 0.3 },
      { date: "5월 26일", value: 0.6 },
      { date: "7월 16일", value: 1.4 },
      { date: "8월 1일", value: 2.2 },
    ],
  },
  {
    id: "fasting-glucose",
    title: "공복혈당",
    status: "주의",
    unit: "mg/dL",
    definition: "공복혈당은 임신성 당뇨를 미리 살펴보는 대표적인 지표예요.",
    trendSummary:
      "임신 중 공복혈당은 95 mg/dL 미만을 목표로 해요.\n최근 수치가 목표치에 조금씩 가까워지고 있어요.\n식후 혈당과 함께 식습관 관리가 도움이 될 수 있어요.",
    range: [70, 130],
    zoneLabels: ["높음", "안정", "낮음"],
    history: [
      { date: "4월 20일", value: 82 },
      { date: "5월 26일", value: 88 },
      { date: "7월 16일", value: 91 },
      { date: "8월 1일", value: 96 },
    ],
  },
  {
    id: "total-cholesterol",
    title: "총콜레스테롤",
    status: "주의",
    unit: "mg/dL",
    definition: "임신 중에는 태반 호르몬 영향으로 콜레스테롤 수치가 자연스럽게 오르는 편이에요.",
    trendSummary:
      "임신 중반 이후 콜레스테롤 수치가 오르는 건 흔한 변화예요.\n다만 오르는 속도가 빨라서 식이 조절을 함께 챙기면 좋아요.",
    range: [150, 300],
    zoneLabels: ["높음", "안정", "낮음"],
    history: [
      { date: "4월 20일", value: 195 },
      { date: "5월 26일", value: 210 },
      { date: "7월 16일", value: 228 },
      { date: "8월 1일", value: 245 },
    ],
  },
  {
    id: "vitamin-d",
    title: "비타민 D",
    status: "주의",
    unit: "ng/mL",
    definition: "비타민 D는 칼슘 흡수와 뼈 건강, 태아 발달에 관여하는 영양소예요.",
    trendSummary:
      "비타민 D는 20 ng/mL 이상을 권장해요.\n최근 수치가 권장 범위 아래쪽에 머무르고 있어요.\n보충제나 일광 노출로 보충해주는 것이 좋아요.",
    range: [5, 40],
    zoneLabels: ["높음", "안정", "낮음"],
    history: [
      { date: "4월 20일", value: 22 },
      { date: "5월 26일", value: 19 },
      { date: "7월 16일", value: 16 },
      { date: "8월 1일", value: 15 },
    ],
  },
  {
    id: "white-blood-cell",
    title: "백혈구 수치",
    status: "안심",
    unit: "10³/µL",
    definition: "백혈구 수치는 몸의 염증·감염 여부를 살펴보는 지표예요.",
    trendSummary: "임신 중에는 백혈구 수치가 다소 높게 나오는 게 자연스러워요.\n네 번의 검사 모두 안정적인 범위를 유지하고 있어요.",
    range: [4, 15],
    zoneLabels: ["높음", "안정", "낮음"],
    history: [
      { date: "4월 20일", value: 8.2 },
      { date: "5월 26일", value: 8.6 },
      { date: "7월 16일", value: 8.1 },
      { date: "8월 1일", value: 8.4 },
    ],
  },
  {
    id: "tsh",
    title: "갑상선자극호르몬 (TSH)",
    status: "안심",
    unit: "µIU/mL",
    definition: "TSH는 갑상선 기능을 살펴보는 지표로, 임신 유지와 태아 발달에 중요해요.",
    trendSummary: "임신 중 TSH 권장 범위 안에서 꾸준히 유지되고 있어요.\n특별히 걱정할 변화는 보이지 않아요.",
    range: [0.1, 4],
    zoneLabels: ["높음", "안정", "낮음"],
    history: [
      { date: "4월 20일", value: 1.6 },
      { date: "5월 26일", value: 1.8 },
      { date: "7월 16일", value: 1.5 },
      { date: "8월 1일", value: 1.7 },
    ],
  },
  {
    id: "ferritin",
    title: "페리틴",
    status: "안심",
    unit: "ng/mL",
    definition: "페리틴은 몸에 저장된 철분량을 보여주는 지표로, 빈혈을 미리 살펴볼 수 있어요.",
    trendSummary: "저장철 수치가 임신 기간 내내 안정적으로 유지되고 있어요.\n지금처럼 철분이 풍부한 식단을 이어가면 좋아요.",
    range: [10, 150],
    zoneLabels: ["높음", "안정", "낮음"],
    history: [
      { date: "4월 20일", value: 62 },
      { date: "5월 26일", value: 58 },
      { date: "7월 16일", value: 55 },
      { date: "8월 1일", value: 60 },
    ],
  },
];

export function getTrendIndicator(id: string) {
  return DEMO_TREND_INDICATORS.find((item) => item.id === id) ?? null;
}

// ---- 기록 탭 (node 837:4436): 지금까지 업로드한 검사지들의 타임라인 ----
// 실제로는 검사지마다 별도 리포트가 쌓여야 하지만, 지금은 "마지막 리포트"
// 하나만 저장하는 구조라 히스토리 자체는 데모 데이터를 쓴다. 날짜는
// DEMO_TREND_INDICATORS의 history와 동일하게 맞췄다.
export type RecordEntry = {
  id: string;
  date: string;
  week: string;
  summary: string;
};

export const DEMO_RECORDS: RecordEntry[] = [
  {
    id: "2026-08-01",
    date: "26.08.01",
    week: "29주차",
    summary: DEMO_SUMMARY,
  },
  {
    id: "2026-07-16",
    date: "26.07.16",
    week: "23주차",
    summary:
      "요단백 수치가 조금씩 오르고 있어 혈압·부종과 함께 지켜볼 필요가 있어요.\n그 외 수치는 대체로 안정적인 범위예요.",
  },
  {
    id: "2026-05-26",
    date: "26.05.26",
    week: "16주차",
    summary:
      "전반적으로 안정적인 결과예요.\n비타민 D 수치가 권장 범위보다 낮아 보충이 필요해요.",
  },
  {
    id: "2026-04-20",
    date: "26.04.20",
    week: "4주차",
    summary:
      "임신 초기 기본 검사 결과가 모두 정상 범위로 확인됐어요.\n앞으로의 검사에서 변화 추이를 함께 지켜봐요.",
  },
];
