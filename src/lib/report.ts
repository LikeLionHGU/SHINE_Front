import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "shine.report.last.v1";

/** lib/insights.ts가 검사항목을 바탕으로 추천해주는 음식 한 개. */
export type ReportFood = { name: string; reason: string };

export type LastReport = {
  /** 업로드한 검사지 이미지의 로컬 URI */
  uri: string;
  /** ISO 날짜 문자열 — 앱에 "저장한" 시각 */
  uploadedAt: string;
  /** 검사지에 실제로 찍힌 검사 날짜("YY.MM.DD"). scan/date-confirm.tsx에서
   * OCR로 읽거나 사용자가 직접 고른 값 — 파싱/선택 전이면 없을 수 있다. */
  testDate?: string;
  /** OCR로 읽어낸 검사항목/수치/상태 목록. 파싱 실패 시 비어있을 수 있다. */
  items?: ParsedTestItem[];
  /** lib/insights.ts가 items를 바탕으로 작성한 종합 소견(3~5문장). 생성 실패 시 없을 수 있다. */
  summary?: string;
  /** 다음 진료 때 물어보면 좋을 추천 질문. 생성 실패 시 없을 수 있다. */
  questions?: string[];
  /** 부족하거나 신경 써야 할 성분을 보완하는 데 도움되는 추천 음식. 생성 실패 시 없을 수 있다. */
  foods?: ReportFood[];
  /** 서버(POST /api/v1/reports)가 발급한 검사지 id. 서버 전송에 실패했으면 없다. */
  testSheetId?: number;
  /** 서버가 계산한 검사 당시 임신 주차 스냅샷("12주차"). 서버 전송에 실패했으면 없다. */
  week?: string;
  /** 여러 항목을 함께 봐야 나오는 소견(전자간증 조합, 빈혈 전 단계 철결핍 등). */
  crossFindings?: { name: string; message: string; status: IndicatorStatus; conditions: string[] }[];
  /** 판정 엔진이 아직 모르는 항목. 조용히 빼지 않고 화면에 밝힌다. */
  unsupported?: { name: string; value: string }[];
  /** 화면 하단 출처 표기. */
  sources?: { label: string; url: string; badge: string }[];
  /** 모델이 스스로 "못 읽겠다"고 남긴 부분. */
  unreadable?: { reason: string; location: string }[];
};

export async function saveLastReport(data: {
  uri: string;
  items?: ParsedTestItem[];
  testDate?: string;
  summary?: string;
  questions?: string[];
  foods?: ReportFood[];
  testSheetId?: number;
  week?: string;
  crossFindings?: LastReport["crossFindings"];
  unsupported?: LastReport["unsupported"];
  sources?: LastReport["sources"];
  unreadable?: LastReport["unreadable"];
}) {
  const report: LastReport = { ...data, uploadedAt: new Date().toISOString() };
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


// ---- 사용자가 직접 고친 값 (검사지별로 따로 보관) ----
//
// 왜 별도 저장소인가:
// 분석 화면은 포커스될 때마다 원본을 다시 읽어온다(로컬 마지막 리포트 또는 서버의
// 지난 검사지). 편집 결과를 그 원본에 섞어두면 다음 진입 때 통째로 덮어써진다.
// 그래서 "원본"과 "사용자 수정분"을 분리해 두고, 화면에서 원본 위에 수정분을 덧씌운다.
// 서버에서 불러온 검사지(uri가 없는 경우)도 이 저장소에는 남길 수 있다.

const EDITS_KEY = "shine.report.edits.v1";

export type ReportEdits = {
  items: ParsedTestItem[];
  summary?: string;
  questions?: string[];
  foods?: ReportFood[];
  crossFindings?: LastReport["crossFindings"];
  unsupported?: LastReport["unsupported"];
  sources?: LastReport["sources"];
  /** 어떤 원본에 대한 수정인지 확인용 — 원본이 바뀌면 이 수정분은 버린다. */
  signature: string;
  editedAt: string;
};

/** 원본이 바뀌었는지 판별하는 지문. 항목 수 + 항목명 목록이면 충분하다. */
export function reportSignature(items: ParsedTestItem[] | undefined): string {
  if (!items?.length) return "empty";
  // 재판정은 항목을 심각도순으로 다시 정렬하므로, 순서에 흔들리지 않도록 정렬해서 만든다.
  // 값이 아니라 "어떤 항목들이 있는지"만 본다 — 값이 바뀌는 게 곧 수정이므로.
  const names = items.map((i) => i.originalName || i.name).sort();
  return `${items.length}|${names.join(",")}`;
}

type EditsStore = Record<string, ReportEdits>;

async function readEditsStore(): Promise<EditsStore> {
  try {
    const raw = await AsyncStorage.getItem(EDITS_KEY);
    return raw ? (JSON.parse(raw) as EditsStore) : {};
  } catch {
    return {};
  }
}

/** key: 기록 탭에서 연 검사지는 recordId, 방금 올린 검사지는 "last" */
export async function saveReportEdits(key: string, edits: Omit<ReportEdits, "editedAt">) {
  const store = await readEditsStore();
  store[key] = { ...edits, editedAt: new Date().toISOString() };
  await AsyncStorage.setItem(EDITS_KEY, JSON.stringify(store));
}

export async function loadReportEdits(key: string): Promise<ReportEdits | null> {
  const store = await readEditsStore();
  return store[key] ?? null;
}

/** 새 검사지를 올렸을 때처럼 원본이 갈아끼워지면 그 키의 수정분은 버린다. */
export async function clearReportEdits(key: string) {
  const store = await readEditsStore();
  if (!(key in store)) return;
  delete store[key];
  await AsyncStorage.setItem(EDITS_KEY, JSON.stringify(store));
}

// scan/date-confirm.tsx가 OCR로 미리 읽어둔 검사항목·검사일을, 다음 단계인
// scan/analyzing.tsx로 넘겨주기 위한 임시 저장소. 두 화면 다 같은 JS
// 런타임에서 돌기 때문에(네이티브 전환이 아니라 같은 앱 안 화면 이동)
// AsyncStorage나 URL 파라미터 없이 모듈 스코프 변수로 충분히 안전하게
// 전달할 수 있다. analyzing.tsx는 이 값이 없거나 uri가 안 맞으면(예: 새로고침
// 등으로 값이 날아간 경우) 스스로 다시 스캔·파싱하도록 방어적으로 처리한다.
type PendingScan = {
  uri: string;
  items?: ParsedTestItem[];
  testDate?: string;
};

let pendingScan: PendingScan | null = null;

export function setPendingScan(value: PendingScan) {
  pendingScan = value;
}

export function takePendingScan(uri: string): PendingScan | null {
  if (!pendingScan || pendingScan.uri !== uri) return null;
  const value = pendingScan;
  pendingScan = null;
  return value;
}

// 실제 DUR/건강기능식품 API·OCR 연동 전까지 쓰는 자리표시 분석 결과.
// Figma(node 671:4356/671:4386 검사지 분석-번역) 문구를 그대로 옮겨왔다.
export const DEMO_SUMMARY =
  "관련 결과 전체적으로 안정적인 수치를 띄며 B형·C형 간염, 매독, HIV 검사에서 모두 이상이 발견되지 않았어요.\n지금 시기에는 비타민 D를 충분히 보충해주는 것이 좋아요.";

// "미분류"는 서버가 판정하지 못한 항목(카탈로그 미매칭, 혈액형처럼 정상/이상 개념이
// 없는 항목)이다. OCR은 이 값을 만들지 않고, 지난 검사지를 서버에서 불러올 때만 나온다.
export type IndicatorStatus = "안심" | "주의" | "위험" | "미분류";

// lib/ocr.ts(OpenAI Vision)가 검사지 사진에서 실제로 읽어낸 한 줄.
// definition/verdict는 report.tsx의 지표 상세 하단 시트(기존 DEMO_INDICATORS와
// 동일한 UI)를 그대로 재사용하기 위해 IndicatorDetail과 같은 모양으로 맞췄다.
export type ParsedTestItem = {
  /** 검사항목 (예: "헤모글로빈") */
  name: string;
  /** 수치 (참고치가 함께 적혀 있으면 원문 그대로, 예: "12.2 g/dL (11~15)") */
  value: string;
  /** OCR 모델이 판단한 상태 */
  status: IndicatorStatus;
  /** 이 검사 항목이 일반적으로 무엇을 보는 지표인지 쉬운 설명 (1~2문장) */
  definition: string;
  /** 이번에 읽은 수치가 왜 이 상태로 판정됐는지에 대한 설명 (1~2문장) */
  verdict: string;
  /**
   * 검사지에 실제로 인쇄돼 있던 원문 항목명 (예: "Hemoglobin", "혈색소(헤모글로빈)").
   * 서버가 카탈로그 대표명("혈색소")으로 바꿔주기 때문에, 사용자가 손에 든 종이와
   * 대조할 수 있도록 원문을 같이 들고 다닌다. 대표명과 같으면 비워둔다.
   */
  originalName?: string;

  // ---- 판정 엔진(lib/labs)이 채우는 값 ----
  // 서버/구버전 데이터에는 없을 수 있으므로 전부 선택 필드다. 화면은 값이 있으면
  // 근거를 함께 보여주고, 없으면 예전처럼 status/verdict만 보여준다.

  /** 엔진이 낸 세분화 상태. "recheck"(재검 필요) "indeterminate"(판정 보류) 등 6종. */
  engineStatus?:
    | "safe"
    | "watch"
    | "recheck"
    | "indeterminate"
    | "alert"
    | "info_only"
    | "unsupported";
  /** 배지에 표시할 라벨 ("재검 필요", "판정 보류", "참고"). */
  badgeLabel?: string;
  /** 무엇과 비교해서 나온 판정인지 ("임신 주수 기준 10.1~14.1"). */
  basisLabel?: string;
  /** 검사지 기준과 임신 중 기준이 엇갈릴 때의 설명. 이 앱의 핵심 가치. */
  contrastNote?: string;
  /** 함께 알려야 하는 주의사항 (검사법 편차, 참고범위와 임상기준의 차이 등). */
  caveats?: string[];
  /** 이 판정의 근거. 비어 있으면 화면에 판정을 띄우지 않는다. */
  citations?: { label: string; url: string; quote?: string; badge: string }[];
  /** 다음 진료 때 물어보면 좋을 질문 한 문장. */
  doctorQuestion?: string;
  /** 이전 검사 대비 변화가 클 때의 안내. */
  trendNote?: string;
  /** OCR을 못 믿겠는 항목 — 사용자에게 "이 숫자 맞나요?" 하고 되물어야 한다. */
  needsConfirm?: boolean;
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
