// lib/labs/types.ts
// SHINE — 산전검사 판정 엔진 타입 정의
// 원칙: LLM은 판정하지 않는다. 판정은 전부 이 타입들 위에서 결정론적으로 이루어진다.

export type Trimester = 'T1' | 'T2' | 'T3';

export type Status =
  | 'safe'          // 임신 주수 기준 범위 안
  | 'watch'         // 벗어났으나 경과 관찰 대상
  | 'recheck'       // 이 수치만으로 확정 불가, 재검이 표준
  | 'indeterminate' // 회색지대 / 검사법 의존 → 판정 보류
  | 'alert'         // 학회 기준상 즉시 상담 필요
  | 'info_only'     // 판정하지 않고 설명만
  | 'unsupported';  // 아직 지원하지 않는 항목 (조용히 빼지 않고 명시)

export type TrustTier = 'A' | 'B' | 'C' | 'D';

export type Verification =
  | 'primary_verified'
  | 'mirror_verified'
  | 'secondary_only'
  | 'unverified';

export interface Source {
  title: string;
  publisher: string;
  published?: string;
  citation_ko: string;
  url: string;
  canonical_url?: string;
  supporting_url?: string;
  open_pdf?: string;
  doi?: string;
  trust_tier: TrustTier;
  verification: Verification;
  verified_at: string;
  sample_size?: string;
  supersedes?: string;
  note?: string;
}

export interface SourceRegistry {
  registry_version: string;
  updated_at: string;
  sources: Record<string, Source>;
  verification_legend: Record<string, string>;
  trust_tier_policy: Record<string, string>;
}

/** 규칙에 붙는 출처. quote는 해당 수치가 나온 원문 문장. */
export interface RuleSource {
  id: string;
  quote?: string;
}

export type RuleOp =
  | 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq'
  | 'aboveRI' | 'belowRI' | 'outsideRI'
  | 'gradeGte'
  | 'panelExceededGte'
  | 'targetExceeded'
  | 'always';

export interface RuleRef {
  kind: 'labUpper' | 'labLower' | 'riUpper' | 'riLower';
  multiplier?: number;
}

export interface RuleGuard {
  trimester?: Trimester[];
  flags?: string[];
  notFlags?: string[];
  minGestationalWeek?: number;
  maxGestationalWeek?: number;
}

export interface Rule {
  id: string;
  guard?: RuleGuard;
  op: RuleOp;
  value?: number | string;
  ref?: RuleRef;
  status: Status;
  label: string;
  message: string;
  sources: RuleSource[];
}

export interface ReferenceIntervals {
  T1: [number, number];
  T2: [number, number];
  T3: [number, number];
  sourceId: string;
  quote?: string;
  trustTier?: TrustTier;
  /** false면 참고 표시용으로만 쓰고 판정에는 쓰지 않는다 */
  useForJudgment?: boolean;
  displayOnly?: boolean;
  reason?: string;
}

export interface PanelSpec {
  cutoffs: Record<string, number>;
  requiredExceeded: number;
  sourceId: string;
  quote?: string;
}

export interface Caveat {
  text: string;
  sourceId?: string;
  sourceIds?: string[];
  quote?: string;
}

export interface LabItem {
  id: string;
  name: string;
  /**
   * 이 검사가 무엇을 보는 항목인지 쉬운 말로 한두 문장.
   * 상세 시트 맨 위에 뜨는 "쉬운 설명"이다. 판정에는 쓰지 않는다.
   */
  description?: string;
  aliases: string[];
  unit: string;
  unitAliases?: Record<string, number>;
  valueType: 'numeric' | 'ordinal' | 'categorical' | 'panel' | 'target';
  plausibleRange?: [number, number];
  gradeScale?: string[];
  qualitativeAliases?: Record<string, string>;
  /** 이 항목이 올라갈 수 있는 최대 심각도 — 과잉 경고 방지 */
  severityCap?: Status;
  gradeToMgPerDl?: Record<string, unknown>;
  quantitativeCutoffs?: Record<string, unknown>;
  referenceIntervals?: ReferenceIntervals;
  alternateReferenceIntervals?: ReferenceIntervals;
  panel?: PanelSpec;
  targets?: Record<string, unknown>;
  rules: Rule[];
  defaultStatus: Status;
  defaultMessage: string;
  defaultSources?: RuleSource[];
  mandatoryCaveat?: Caveat;
  uncertaintyNote?: Caveat;
  consistencyNote?: Caveat;
  screening?: Caveat;
  guidelineFallbackUpper?: Record<string, unknown>;
  fallbackWhenNoLabRange?: { upper?: number; lower?: number; sourceId: string; note?: string };
  requiresPrintedLabRange?: boolean;
  preferPrintedLabRange?: boolean;
  secondaryTo?: string;
  dualStandard?: boolean;
  privacy?: { hideFromSummaryCards?: boolean; hideFromPush?: boolean; requireExplicitOpen?: boolean };
  toneRule?: string;
  correctionNote?: string;
  deprecated?: Array<{ what: string; why: string; sourceId: string; quote?: string }>;
  context?: string;
}

export interface CrossRule {
  id: string;
  name: string;
  requires: { minGestationalWeek?: number; allOf?: string[]; anyOf?: string[] };
  condition?: string;
  triggerConditions?: Array<{ text: string; field: string }>;
  status: Status;
  message: string;
  sources: RuleSource[];
}

export interface ReferenceData {
  schema_version: string;
  updated_at: string;
  policy: {
    range_priority: string[];
    min_trust_tier_for_judgment: TrustTier[];
    block_tier_d: boolean;
    unknown_item_behavior: string;
    missing_unit_behavior: string;
  };
  trimester_weeks: Record<Trimester, [number, number]>;
  items: LabItem[];
  crossRules: CrossRule[];
  pendingVerification: Array<{ item: string; affects: string[]; action: string }>;
}

// ---------- 입력 ----------

/** OCR이 검사지에서 뽑아낸 한 줄. 판정은 절대 하지 않는다. */
export interface ExtractedRow {
  rawName: string;
  rawValue: string;
  value?: number;
  grade?: string;
  qualitative?: 'positive' | 'negative' | 'rh_negative' | 'rh_positive';
  unit?: string;
  /** 검사지에 인쇄된 참고범위 (1순위 판정 기준) */
  printedRange?: { lower?: number; upper?: number; raw: string };
  /** 검사실이 표시한 H / L 플래그 — OCR 오독 검증에 사용 */
  flag?: 'H' | 'L' | 'N';
  panelValues?: Record<string, number>;
  confidence?: number;
  /** 같은 사진을 두 번 읽었을 때 값이 갈린 경우의 사유. 있으면 판정하지 않는다. */
  uncertain?: string;
  /** 입력 배열에서의 위치. 판정 결과를 원본 행과 정확히 짝지을 때 쓴다. */
  sourceIndex?: number;
}

export interface UserContext {
  gestationalWeek?: number;
  trimester?: Trimester;
  flags?: string[];            // 'high_risk' | 'gdm_diagnosed' | 'on_iron_supplement' ...
  bloodPressure?: { systolic: number; diastolic: number };
  symptoms?: string[];
  previousResults?: Array<{ itemId: string; value: number; testedAt: string }>;
}

// ---------- 출력 ----------

export interface Citation {
  sourceId: string;
  label: string;      // 사용자에게 보여줄 한국어 출처명
  url: string;
  quote?: string;
  trustTier: TrustTier;
  verification: Verification;
  published?: string;
}

export interface PrintedRangeContext {
  lower?: number;
  upper?: number;
  raw: string;
  /** 검사지 기준으로는 벗어났는가 */
  outsidePrinted: boolean;
  /** 검사지 기준과 임신 중 기준이 엇갈릴 때 사용자에게 보여줄 설명 */
  contrastNote?: string;
}

export interface RangeBasis {
  kind: 'printed_lab_range' | 'trimester_reference_interval' | 'guideline_cutoff' | 'none';
  uiLabel: string;
  lower?: number;
  upper?: number;
  citation?: Citation;
}

export interface Judgment {
  itemId: string;
  itemName: string;
  /** 이 판정이 어느 입력 행에서 나왔는지 (이름 매칭에 기대지 않기 위함) */
  sourceIndex?: number;
  /** 검사지에 인쇄돼 있던 원문 항목명 */
  sourceName?: string;
  /** 검사지에 인쇄돼 있던 원문 결과값 (정성 결과 비교에 필요) */
  sourceValue?: string;
  status: Status;
  label: string;
  message: string;
  value?: number;
  grade?: string;
  unit?: string;
  /** 어떤 기준으로 판정했는지 — UI에 반드시 노출 */
  basis: RangeBasis;
  /** 검사지에 인쇄된 참고범위 (판정 기준이 아니어도 항상 함께 보여준다) */
  printedRange?: PrintedRangeContext;
  /** 이 판정을 뒷받침하는 출처. 비어 있으면 판정하지 않는다. */
  citations: Citation[];
  caveats: string[];
  /** OCR 신뢰도 관련 경고 */
  dataQuality: {
    unitConverted?: { from: string; factor: number };
    flagMismatch?: boolean;
    /** 검사실 H/L 표시가 '비임신 기준' 때문이라고 설명 가능한 경우 */
    flagExplainedByPregnancy?: boolean;
    outOfPlausibleRange?: boolean;
    needsUserConfirmation?: boolean;
    notes: string[];
  };
  trend?: TrendResult;
}

export interface TrendResult {
  previousValue: number;
  previousDate: string;
  delta: number;
  deltaPercent: number;
  direction: 'up' | 'down' | 'flat';
  significant: boolean;
  message?: string;
}

export interface EvaluationResult {
  judgments: Judgment[];
  crossFindings: Array<{
    ruleId: string;
    name: string;
    status: Status;
    message: string;
    matchedConditions: string[];
    citations: Citation[];
  }>;
  unsupported: Array<{ rawName: string; rawValue: string; reason: string }>;
  meta: {
    dataVersion: string;
    dataUpdatedAt: string;
    evaluatedAt: string;
    trimester?: Trimester;
    gestationalWeek?: number;
    /** 같은 항목이 반복 추출돼 합쳐진 줄 수 */
    removedDuplicates?: number;
    /** 같은 항목인데 값이 갈려서 판정을 멈춘 항목명 */
    conflictingDuplicates?: string[];
  };
}
