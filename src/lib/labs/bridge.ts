// src/lib/labs/bridge.ts
// 판정 엔진(evaluate)과 앱의 기존 화면 타입(ParsedTestItem)을 잇는 어댑터.
// 화면 코드는 이 파일만 알면 되고, 엔진 내부 타입을 직접 쓰지 않는다.

import { evaluate } from "./evaluate";
import type { ExtractedRow, Judgment, Status, UserContext } from "./types";
import { normalizeKey, parseValueString } from "./normalize";
import type { IndicatorStatus, ParsedTestItem } from "@/lib/report";

/** 엔진 상태 → 배지에 쓸 한국어 라벨 */
export const ENGINE_STATUS_LABEL: Record<Status, string> = {
  safe: "안심",
  watch: "확인 필요",
  recheck: "재검 필요",
  indeterminate: "판정 보류",
  alert: "즉시 상담",
  info_only: "참고",
  unsupported: "미지원",
};

/** 엔진 상태 → 기존 4색 배지 색상 키 (서버 데이터와 호환 유지) */
export function toIndicatorStatus(s: Status): IndicatorStatus {
  switch (s) {
    case "safe":
      return "안심";
    case "watch":
    case "recheck":
      return "주의";
    case "alert":
      return "위험";
    default:
      return "미분류";
  }
}

function basisText(j: Judgment): string {
  const { basis } = j;
  const hasRange = basis.lower !== undefined || basis.upper !== undefined;
  if (!hasRange) return basis.uiLabel;
  if (basis.lower !== undefined && basis.upper !== undefined)
    return `${basis.uiLabel} ${basis.lower}~${basis.upper}`;
  if (basis.upper !== undefined) return `${basis.uiLabel} ${basis.upper} 이하`;
  return `${basis.uiLabel} ${basis.lower} 이상`;
}

function verificationBadge(v: string): string {
  if (v === "primary_verified") return "원문 확인";
  if (v === "mirror_verified") return "원문(미러) 확인";
  if (v === "secondary_only") return "2차 자료";
  return "미검증";
}

/** 판정 결과에서 "다음 진료 때 물어볼 질문" 한 문장 생성 */
export function doctorQuestionOf(j: Judgment): string | undefined {
  const v = j.value ?? j.grade;
  if (v === undefined) return undefined;
  const unit = j.unit && j.unit !== "qualitative" && j.unit !== "categorical" && j.unit !== "dipstick" ? j.unit : "";
  switch (j.status) {
    case "watch":
      return `${j.itemName}이 ${v}${unit}였는데, 지금 조치가 필요할까요?`;
    case "recheck":
      return `${j.itemName}이 ${v}${unit}였는데 재검이 필요한가요? 언제 다시 하면 될까요?`;
    case "indeterminate":
      return `${j.itemName} 결과가 애매한 구간이라고 나왔는데 어떻게 보면 될까요?`;
    case "alert":
      return `${j.itemName}이 ${v}${unit}로 나왔는데 지금 어떻게 해야 할까요?`;
    default:
      return undefined;
  }
}

function judgmentToItem(j: Judgment, rawName: string, rawValue: string): ParsedTestItem {
  const engineUnit =
    j.unit && !["qualitative", "categorical", "dipstick"].includes(j.unit) ? ` ${j.unit}` : "";
  // 정성 결과는 영어 그대로 두지 않는다. 검사지엔 "양성/음성"으로 적혀 있는데
  // 화면에 "positive"라고 뜨면 사용자가 자기 종이와 대조하지 못한다.
  const QUALITATIVE_KO: Record<string, string> = {
    positive: "양성",
    negative: "음성",
    reactive: "양성",
    nonreactive: "음성",
    nr: "음성",
    rh_negative: "Rh 음성",
    rh_positive: "Rh 양성",
  };
  const rawKey = (rawValue ?? "").trim().toLowerCase();
  const shownValue =
    j.value !== undefined
      ? `${j.value}${engineUnit}`
      : (j.grade ?? QUALITATIVE_KO[rawKey] ?? rawValue ?? "-");

  return {
    name: j.itemName,
    value: shownValue,
    status: toIndicatorStatus(j.status),
    definition: "",
    verdict: j.message,
    originalName: rawName !== j.itemName ? rawName : undefined,

    // --- 엔진이 추가로 실어 보내는 값 (화면에서 근거를 보여주기 위한 것) ---
    engineStatus: j.status,
    // "판정 보류"보다 "결과 없음"·"확인 필요"가 사용자에게 훨씬 유용하다.
    // 판정이 준 구체적인 라벨이 있으면 그걸 배지에 쓴다.
    badgeLabel: j.label && j.label !== '정상' ? j.label : ENGINE_STATUS_LABEL[j.status],
    basisLabel: basisText(j),
    contrastNote: j.printedRange?.contrastNote,
    caveats: j.caveats,
    citations: j.citations.map((c) => ({
      label: c.label,
      url: c.url,
      quote: c.quote,
      badge: verificationBadge(c.verification),
    })),
    doctorQuestion: doctorQuestionOf(j),
    trendNote: j.trend?.significant ? j.trend.message : undefined,
    // 사용자에게 "이 숫자 맞나요?" 하고 되물어야 하는 항목
    needsConfirm:
      j.dataQuality.needsUserConfirmation === true ||
      j.dataQuality.outOfPlausibleRange === true ||
      j.status === 'indeterminate',
  };
}

export type AnalyzeResult = {
  items: ParsedTestItem[];
  /** 여러 항목을 함께 봐야 나오는 소견 (전자간증 조합, 철 결핍 전 단계 등) */
  crossFindings: { name: string; message: string; status: IndicatorStatus; conditions: string[] }[];
  /** 아직 지원하지 않는 항목 — 조용히 빼지 않고 화면에 밝힌다 */
  unsupported: { name: string; value: string }[];
  /** 화면 하단 출처 표기용 */
  sources: { label: string; url: string; badge: string }[];
  dataUpdatedAt: string;
};

/** OCR이 뽑은 행들을 판정해 화면이 쓰는 형태로 변환한다. LLM 호출 없음. */
export function analyzeRows(rows: ExtractedRow[], ctx: UserContext): AnalyzeResult {
  const result = evaluate(rows, ctx);
  const rawByItem = new Map<string, ExtractedRow>();
  for (const r of rows) rawByItem.set(r.rawName, r);

  const items = result.judgments.map((j) => {
    // 이름으로 원본 행을 되찾으면(예전 방식) catalog명으로 바뀐 뒤엔 엉뚱한 행이 붙는다.
    // 판정에 실려온 sourceIndex로 정확히 짝짓는다.
    const raw = j.sourceIndex !== undefined ? rows[j.sourceIndex] : undefined;
    return judgmentToItem(j, j.sourceName ?? raw?.rawName ?? j.itemName, raw?.rawValue ?? "");
  });

  const seen = new Map<string, { label: string; url: string; badge: string }>();
  for (const j of result.judgments)
    for (const c of j.citations)
      if (c.url) seen.set(c.sourceId, { label: c.label, url: c.url, badge: verificationBadge(c.verification) });
  for (const f of result.crossFindings)
    for (const c of f.citations)
      if (c.url) seen.set(c.sourceId, { label: c.label, url: c.url, badge: verificationBadge(c.verification) });

  return {
    items,
    crossFindings: result.crossFindings.map((f) => ({
      name: f.name,
      message: f.message,
      status: toIndicatorStatus(f.status),
      conditions: f.matchedConditions,
    })),
    unsupported: result.unsupported.map((u) => ({ name: u.rawName, value: u.rawValue })),
    sources: Array.from(seen.values()),
    dataUpdatedAt: result.meta.dataUpdatedAt,
  };
}

/**
 * 서버에서 불러온 지난 검사지 항목을 판정 엔진으로 다시 판정한다.
 * 서버 판정에는 근거(출처)가 붙어 있지 않고 임신 기준 반영도 항목마다 들쭉날쭉하다.
 * 값 문자열("3.79 % (33~44)")에 참고범위가 들어 있는 경우가 많아서, 그걸 되살리면
 * 기록 탭에서 연 지난 검사지에도 같은 품질의 판정을 보여줄 수 있다.
 *
 * 엔진이 판정하지 못한 항목은 서버가 준 값을 그대로 둔다(정보를 지우지 않는다).
 */
export function reanalyzeItems(items: ParsedTestItem[], ctx: UserContext): AnalyzeResult {
  const rows: ExtractedRow[] = items.map((item) => {
    const parsed = parseValueString(item.value ?? "");
    return {
      rawName: item.originalName || item.name,
      rawValue: item.value ?? "",
      value: parsed.value,
      unit: parsed.unit,
      printedRange: parsed.printedRange,
      qualitative: parsed.qualitative,
      flag: "N" as const,
    };
  });

  const analyzed = analyzeRows(rows, ctx);

  // 엔진이 못 다룬 항목은 서버 값을 살려서 뒤에 붙인다.
  // 주의: 빈 문자열이 집합에 섞이면 originalName이 없는 항목이 전부 "이미 판정됨"으로
  // 취급돼 조용히 사라진다. 이름 정규화 기준으로만 비교한다.
  const judged = new Set(
    analyzed.items.flatMap((i) => [i.name, i.originalName].filter(Boolean).map((n) => normalizeKey(n as string))),
  );
  const leftovers = items.filter((item) => {
    const keys = [item.name, item.originalName].filter(Boolean).map((n) => normalizeKey(n as string));
    return keys.length > 0 && !keys.some((k) => judged.has(k));
  });
  return { ...analyzed, items: [...analyzed.items, ...leftovers] };
}

/**
 * 판정 결과만으로 추천 질문을 만든다. LLM 호출이 필요 없고, 표와 항상 일치한다.
 * AI 재생성이 실패했거나 저장된 질문이 없을 때 화면이 비지 않도록 하는 최후 보루.
 */
export function buildEngineQuestions(items: ParsedTestItem[]): string[] {
  const order: Record<string, number> = {
    alert: 0, recheck: 1, indeterminate: 2, watch: 3, info_only: 9, safe: 9, unsupported: 9,
  };
  return items
    .filter((it) => !!it.doctorQuestion)
    .sort((a, b) => (order[a.engineStatus ?? "safe"] ?? 9) - (order[b.engineStatus ?? "safe"] ?? 9))
    .map((it) => it.doctorQuestion as string)
    .slice(0, 4);
}

/**
 * 판정 결과만으로 종합 소견 한 문단을 만든다. AI가 쓴 문장보다 딱딱하지만,
 * 틀린 값으로 만든 옛 문장을 남겨두는 것보다는 훨씬 낫다.
 */
export function buildEngineSummary(items: ParsedTestItem[], gestationalWeek?: number): string {
  const count = (s: string) => items.filter((i) => i.engineStatus === s).length;
  const head = gestationalWeek ? `임신 ${gestationalWeek}주차에 받은 이번 검사예요.` : "이번 검사 결과예요.";
  const parts: string[] = [];
  const alert = count("alert"), recheck = count("recheck"), indet = count("indeterminate"), watch = count("watch");

  if (alert > 0) {
    const names = items.filter((i) => i.engineStatus === "alert").map((i) => i.name).join(", ");
    parts.push(`${names}은(는) 담당 의료진과 바로 상의가 필요한 구간이에요.`);
  }
  if (recheck > 0) parts.push(`${recheck}개 항목은 이 수치만으로 확정할 수 없어 재검으로 확인이 필요해요.`);
  if (indet > 0) parts.push(`${indet}개 항목은 숫자가 확실하지 않아 판정을 보류했어요. 값을 확인해 주세요.`);
  if (watch > 0) parts.push(`${watch}개 항목은 다음 진료 때 확인해 보시면 좋아요.`);
  if (parts.length === 0) parts.push("확인된 항목은 모두 임신 주수 기준 범위 안이에요.");

  return [head, ...parts].join(" ");
}

export type { ExtractedRow, UserContext, Status };
