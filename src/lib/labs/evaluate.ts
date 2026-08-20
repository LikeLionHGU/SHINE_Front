// lib/labs/evaluate.ts
// 결정론적 판정 엔진. LLM 호출 없음. 같은 입력이면 항상 같은 출력.
//
// 판정 기준 우선순위 (data/reference_ranges.json의 policy.range_priority):
//   1) 검사지에 인쇄된 참고범위   2) 임신 주수별 참고구간   3) 학회 컷오프

import type {
  Citation, CrossRule, EvaluationResult, ExtractedRow, Judgment, LabItem,
  PrintedRangeContext, RangeBasis, ReferenceData, Rule, Status, Trimester, UserContext,
} from './types';
import { toCitations, citationById, isJudgmentGrade } from './sources';
import { matchItem, convertUnit, checkPlausible, trimesterOf, normalizeGrade, normalizeQualitative, isEmptyValue, dedupeRows, coreName, isMicroscopyUnit } from './normalize';
import referenceJson from './data/reference_ranges.json';

export const referenceData = referenceJson as unknown as ReferenceData;

const STATUS_SEVERITY: Record<Status, number> = {
  safe: 0, info_only: 0, unsupported: 0, watch: 2, indeterminate: 2, recheck: 3, alert: 4,
};

export function severity(s: Status): number { return STATUS_SEVERITY[s] ?? 0; }

/**
 * 같은 항목이 두 행에서 나왔을 때 "어느 쪽 읽기를 믿을지" 점수.
 * 높을수록 신뢰할 만하다. 동점이면 판정을 거두고 사용자에게 되묻는다.
 */
function fitness(j: Judgment): number {
  let score = 0;
  if (j.status !== 'indeterminate') score += 4;      // 이미 판정이 선 쪽
  if (j.dataQuality?.outOfPlausibleRange !== true) score += 2; // 자릿수가 말이 되는 쪽
  if (j.dataQuality?.needsUserConfirmation !== true) score += 1; // 단위·해석이 확실한 쪽
  return score;
}

// ---------- 참고범위 결정 ----------

function resolveBasis(item: LabItem, row: ExtractedRow, trimester?: Trimester): RangeBasis {
  const hasPrinted = !!row.printedRange && (row.printedRange.lower !== undefined || row.printedRange.upper !== undefined);

  // 검사지에 인쇄된 참고범위를 1순위로 쓰는 항목은, 임신 전용 기준이 합의되지 않아
  // 검사 장비별 편차가 판정을 좌우하는 항목뿐이다 (TSH, free T4, ALT/AST 절대 상한).
  // 헤모글로빈·페리틴·혈소판처럼 임신 전용 컷오프가 있는 항목은 검사지 범위(대개 비임신 성인 기준)를
  // 그대로 쓰면 오히려 틀린다 — 이 경우 임신 기준으로 판정하고, 검사지 범위는 대조용으로만 보여준다.
  const printedIsAuthoritative = item.preferPrintedLabRange === true || item.requiresPrintedLabRange === true;

  if (hasPrinted && printedIsAuthoritative) {
    return {
      kind: 'printed_lab_range',
      uiLabel: '내 검사지에 적힌 기준',
      lower: row.printedRange!.lower,
      upper: row.printedRange!.upper,
    };
  }
  // 2순위: 임신 주수별 참고구간 (판정 사용이 허용된 것만)
  const ri = item.referenceIntervals;
  if (ri && trimester && ri.useForJudgment !== false) {
    const [lower, upper] = ri[trimester];
    const cit = citationById(ri.sourceId, ri.quote);
    return {
      kind: 'trimester_reference_interval',
      uiLabel: '임신 주수 기준',
      lower, upper,
      citation: cit ?? undefined,
    };
  }
  // 3순위: 학회 컷오프 fallback
  if (item.fallbackWhenNoLabRange) {
    const f = item.fallbackWhenNoLabRange;
    return {
      kind: 'guideline_cutoff',
      uiLabel: '학회 기준',
      lower: f.lower, upper: f.upper,
      citation: citationById(f.sourceId, f.note) ?? undefined,
    };
  }
  if (hasPrinted) {
    return {
      kind: 'printed_lab_range',
      uiLabel: '내 검사지에 적힌 기준',
      lower: row.printedRange!.lower,
      upper: row.printedRange!.upper,
    };
  }
  return { kind: 'none', uiLabel: '학회 고정 기준' };
}

// ---------- 규칙 평가 ----------

function guardPasses(rule: Rule, ctx: UserContext, trimester?: Trimester): boolean {
  const g = rule.guard;
  if (!g) return true;
  if (g.trimester && (!trimester || !g.trimester.includes(trimester))) return false;
  if (g.minGestationalWeek !== undefined && (ctx.gestationalWeek === undefined || ctx.gestationalWeek < g.minGestationalWeek)) return false;
  if (g.maxGestationalWeek !== undefined && (ctx.gestationalWeek === undefined || ctx.gestationalWeek > g.maxGestationalWeek)) return false;
  const flags = ctx.flags ?? [];
  if (g.flags && !g.flags.every((f) => flags.includes(f))) return false;
  if (g.notFlags && g.notFlags.some((f) => flags.includes(f))) return false;
  return true;
}

function refValue(rule: Rule, basis: RangeBasis, item: LabItem, trimester?: Trimester): number | undefined {
  if (!rule.ref) return undefined;
  const m = rule.ref.multiplier ?? 1;
  const ri = item.referenceIntervals && trimester ? item.referenceIntervals[trimester] : undefined;
  switch (rule.ref.kind) {
    case 'labUpper': return basis.upper !== undefined ? basis.upper * m : undefined;
    case 'labLower': return basis.lower !== undefined ? basis.lower * m : undefined;
    case 'riUpper': return ri ? ri[1] * m : (basis.upper !== undefined ? basis.upper * m : undefined);
    case 'riLower': return ri ? ri[0] * m : (basis.lower !== undefined ? basis.lower * m : undefined);
  }
}

function ruleMatches(
  rule: Rule, row: ExtractedRow, item: LabItem, basis: RangeBasis, value?: number, grade?: string,
): boolean {
  switch (rule.op) {
    case 'always': return true;
    case 'lt': return value !== undefined && value < (rule.value as number);
    case 'lte': return value !== undefined && value <= (rule.value as number);
    case 'gt': {
      const t = rule.ref ? refValue(rule, basis, item) : (rule.value as number);
      return value !== undefined && t !== undefined && value > t;
    }
    case 'gte': {
      const t = rule.ref ? refValue(rule, basis, item) : (rule.value as number);
      return value !== undefined && t !== undefined && value >= t;
    }
    case 'eq': return row.qualitative === rule.value || grade === rule.value;
    case 'neq': return row.qualitative !== rule.value;
    case 'aboveRI': return value !== undefined && basis.upper !== undefined && value > basis.upper;
    case 'belowRI': return value !== undefined && basis.lower !== undefined && value < basis.lower;
    case 'outsideRI':
      return value !== undefined &&
        ((basis.upper !== undefined && value > basis.upper) || (basis.lower !== undefined && value < basis.lower));
    case 'gradeGte': {
      if (!grade || !item.gradeScale) return false;
      const gi = item.gradeScale.indexOf(grade);
      const ti = item.gradeScale.indexOf(rule.value as string);
      return gi >= 0 && ti >= 0 && gi >= ti;
    }
    case 'panelExceededGte': {
      if (!item.panel || !row.panelValues) return false;
      const n = Object.entries(item.panel.cutoffs)
        .filter(([k, cut]) => row.panelValues![k] !== undefined && row.panelValues![k] >= cut).length;
      return n >= (rule.value as number);
    }
    case 'targetExceeded': {
      if (!item.targets || !row.panelValues) return false;
      return Object.entries(item.targets)
        .filter(([, v]) => typeof v === 'number')
        .some(([k, v]) => row.panelValues![k] !== undefined && row.panelValues![k] >= (v as number));
    }
    default: return false;
  }
}

// ---------- 단일 항목 판정 ----------

export function evaluateRow(row: ExtractedRow, ctx: UserContext): Judgment | { unsupported: true; rawName: string; rawValue: string; reason: string } {
  const trimester = ctx.trimester ?? trimesterOf(ctx.gestationalWeek);
  const match = matchItem(row.rawName, referenceData.items);
  if (!match.item) {
    return { unsupported: true, rawName: row.rawName, rawValue: row.rawValue, reason: match.reason ?? '미지원 항목' };
  }
  // 요침사의 'WBC 0-3 /HPF'는 혈액 백혈구와 이름만 같은 다른 검사다.
  // 여기서 걸러내지 않으면 itemId가 겹쳐, 병합 단계에서 혈액 백혈구 판정까지 사라진다.
  if (isMicroscopyUnit(row.unit) && !isMicroscopyUnit(match.item.unit)) {
    return {
      unsupported: true, rawName: row.rawName, rawValue: row.rawValue,
      reason: `단위가 '${row.unit}'라 현미경 계수 항목으로 보임 — 혈액 ${match.item.name}과(와) 구분함`,
    };
  }
  const item = match.item;

  // 결과값이 비어 있으면 절대 판정하지 않는다.
  // ('-'를 '안심'으로 표시하던 v1 버그. 값이 없는데 정상이라고 말하면 안 된다.)
  if (isEmptyValue(row.rawValue) && row.value === undefined && !row.panelValues) {
    return {
      itemId: item.id, itemName: item.name, status: 'indeterminate',
      label: '결과 없음', message: '이 항목은 결과값이 비어 있어 판정하지 않습니다. 검사를 하지 않았거나 결과가 아직 나오지 않았을 수 있어요.',
      unit: item.unit,
      basis: { kind: 'none', uiLabel: '판정 안 함' },
      citations: [], caveats: [],
      dataQuality: { needsUserConfirmation: true, notes: [`결과값이 '${row.rawValue}'로 비어 있음`] },
    };
  }

  // 두 번 읽어서 값이 갈린 항목은 판정하지 않는다. 어느 쪽이 맞는지 모르는 채로
  // 판정하면, 틀린 값에 근거를 붙여 그럴듯하게 보여주는 최악의 결과가 된다.
  if (row.uncertain) {
    return {
      itemId: item.id, itemName: item.name, status: 'indeterminate',
      label: '확인 필요',
      message: `${row.uncertain} 어느 쪽이 맞는지 확인되면 판정해 드릴게요.`,
      value: row.value, unit: item.unit,
      basis: { kind: 'none', uiLabel: '판정 안 함' },
      citations: [], caveats: [],
      dataQuality: { needsUserConfirmation: true, notes: [row.uncertain] },
    };
  }

  const notes: string[] = [];
  const caveats: string[] = [];
  let needsUserConfirmation = false;
  let outOfPlausibleRange = false;
  let unitConverted: { from: string; factor: number } | undefined;

  // 값 준비
  let value = row.value;
  let grade = row.grade;

  if (item.valueType === 'ordinal' && item.gradeScale) {
    grade = grade ?? normalizeGrade(row.rawValue, item.gradeScale);
    if (!grade) {
      notes.push(`'${row.rawValue}'를 등급으로 해석하지 못했습니다.`);
      needsUserConfirmation = true;
    }
  }
  if (item.valueType === 'categorical' && !row.qualitative) {
    const q = normalizeQualitative(row.rawValue, item.qualitativeAliases);
    if (q) row = { ...row, qualitative: q };
    else { notes.push(`'${row.rawValue}'를 양성/음성으로 해석하지 못했습니다.`); needsUserConfirmation = true; }
  }
  // 수치 항목인데 검사지에 숫자 대신 '양성/음성'만 적힌 경우가 있다.
  // (풍진 IgG를 '양성(>500)'으로 내보내는 검사기관이 많다.) 숫자 규칙은 전부
  // 빗나가서 defaultStatus로 떨어지고, 화면에는 '판정 보류'만 남았다.
  // 숫자가 없을 때만 양성/음성을 읽어, 숫자가 있는 경우의 판정은 건드리지 않는다.
  if (item.valueType === 'numeric' && row.value === undefined && !row.qualitative) {
    const q = normalizeQualitative(row.rawValue, item.qualitativeAliases);
    if (q) row = { ...row, qualitative: q };
  }

  if (item.valueType === 'numeric' && value !== undefined) {
    // 단위 환산
    const conv = convertUnit(value, row.unit, item);
    if (conv.error) {
      notes.push(conv.error);
      needsUserConfirmation = true; // 단위를 모르면 판정하지 않는다
    }
    if (conv.converted) {
      value = conv.value;
      unitConverted = { from: conv.from!, factor: conv.factor! };
      notes.push(`단위를 ${conv.from} → ${item.unit}로 환산했습니다.`);
    }
    // 자릿수 검증
    const pl = checkPlausible(value, item);
    if (!pl.ok) {
      outOfPlausibleRange = true;
      needsUserConfirmation = true;
      notes.push(pl.note ?? '값이 가능한 범위를 벗어났습니다.');
      if (pl.suggestion !== undefined) notes.push(`혹시 ${pl.suggestion} ${item.unit}인가요?`);
    }
  }

  let basis = resolveBasis(item, row, trimester);

  // 검사지에 참고범위가 필수인 항목인데 없으면
  if (item.requiresPrintedLabRange && basis.kind !== 'printed_lab_range') {
    caveats.push('이 항목은 검사실마다 정상 상한이 달라, 검사지에 적힌 참고범위로 보는 것이 가장 정확합니다.');
  }

  // 단위를 모르거나 값이 이상하면 판정 보류
  if (needsUserConfirmation && item.valueType === 'numeric') {
    // 검사지 참고범위가 같이 읽혔다면, 자릿수가 몇 배 어긋났는지까지 짚어 되묻는다.
    const pr = row.printedRange;
    const scale = value !== undefined && pr ? detectScaleMisread(value, pr.lower, pr.upper) : { suspect: false as const };
    const rangeText = pr ? `${pr.lower ?? ''}~${pr.upper ?? ''}`.replace(/^~|~$/, '') : '';
    const askMessage = scale.suspect
      ? `검사지에 적힌 참고범위(${rangeText})와 자릿수가 맞지 않아 판정을 보류했어요. 혹시 ${(scale as { suggestion?: number }).suggestion}${item.unit ? ' ' + item.unit : ''}인가요? 사진이 흐리면 숫자를 잘못 읽을 수 있어요.`
      : '입력된 수치나 단위를 확실하게 읽지 못해 판정을 보류합니다. 검사지의 값을 확인해 주세요.';
    return {
      itemId: item.id, itemName: item.name, status: 'indeterminate',
      label: '확인 필요', message: askMessage,
      value, unit: item.unit, basis,
      citations: [], caveats,
      dataQuality: { unitConverted, outOfPlausibleRange, needsUserConfirmation, notes },
    };
  }

  // 규칙 평가 (선언 순서대로, 첫 매치 채택)
  let matched: Rule | undefined;
  for (const rule of item.rules) {
    if (!guardPasses(rule, ctx, trimester)) continue;
    if (ruleMatches(rule, row, item, basis, value, grade)) { matched = rule; break; }
  }

  // 판정 기준 재표기: 규칙이 학회 컷오프(리터럴 숫자)로 판정했다면 basis도 그것을 가리켜야 한다.
  const NUMERIC_OPS = ['lt', 'lte', 'gt', 'gte'];
  if (matched && !matched.ref && typeof matched.value === 'number' && NUMERIC_OPS.includes(matched.op)) {
    const isUpper = matched.op === 'gt' || matched.op === 'gte';
    basis = {
      kind: 'guideline_cutoff',
      uiLabel: '학회 기준',
      lower: isUpper ? undefined : (matched.value as number),
      upper: isUpper ? (matched.value as number) : undefined,
    };
  }

  let status: Status = matched?.status ?? item.defaultStatus;
  let label = matched?.label ?? '정상';
  let message = matched?.message ?? item.defaultMessage;
  let citations: Citation[] = toCitations(matched?.sources);

  // 근거 무결성 게이트
  // - 학회 컷오프(literal value)를 주장하는 규칙은 tier A/B 출처가 반드시 있어야 한다.
  // - 검사지에 인쇄된 참고범위를 기준으로 상대 비교하는 규칙(ref 사용)은, 근거가 검사지 자체이므로 예외.
  const isRelativeToPrintedRange = !!matched?.ref && basis.kind === 'printed_lab_range';
  if (matched && citations.length > 0 && !isRelativeToPrintedRange) {
    const usable = citations.filter((c) => isJudgmentGrade(c.sourceId, referenceData.policy.min_trust_tier_for_judgment));
    if (usable.length === 0) {
      status = 'indeterminate';
      label = '판정 보류';
      message = '이 항목의 판정 근거가 아직 원문 검증되지 않아 판정하지 않습니다. 담당 의료진에게 확인하세요.';
      caveats.push('근거 문헌 검증이 완료되면 판정이 활성화됩니다.');
    }
  }
  // 기본값(safe)일 때도 어떤 기준으로 정상인지 출처를 붙인다
  if (!matched && item.defaultSources) citations = toCitations(item.defaultSources);
  if (citations.length === 0 && !matched && basis.citation) citations = [basis.citation];
  // 검사지 참고범위가 기준이면 '검사기관 제공'을 출처로 명시한다 (출처 0건 판정을 만들지 않는다)
  if (citations.length === 0 && basis.kind === 'printed_lab_range') {
    citations = [{
      sourceId: 'printed_lab_range',
      label: '검사지에 인쇄된 참고범위 (검사기관 제공)',
      url: '',
      quote: row.printedRange?.raw,
      trustTier: 'A',
      verification: 'primary_verified',
    }];
  }
  // 임신 주수별 참고구간으로 판정했는데 규칙이 매칭 안 된 경우에도 근거를 붙인다
  if (citations.length === 0 && item.referenceIntervals) {
    const c = citationById(item.referenceIntervals.sourceId, item.referenceIntervals.quote);
    if (c) citations = [c];
  }

  // 검사지에 인쇄된 참고범위 대조 컨텍스트 (판정 기준이 아니어도 항상 보여준다)
  let printedCtx: PrintedRangeContext | undefined;
  if (row.printedRange && value !== undefined) {
    const pr = row.printedRange;
    const outside =
      (pr.upper !== undefined && value > pr.upper) || (pr.lower !== undefined && value < pr.lower);
    printedCtx = { lower: pr.lower, upper: pr.upper, raw: pr.raw, outsidePrinted: outside };
  }

  // H/L 플래그 대조
  let flagMismatch = false;
  let flagExplainedByPregnancy = false;
  const weSayAbnormal = status !== 'safe' && status !== 'info_only';
  const labSaysAbnormal = (row.flag === 'H' || row.flag === 'L') || (printedCtx?.outsidePrinted ?? false);

  if (labSaysAbnormal && !weSayAbnormal) {
    if (basis.kind !== 'printed_lab_range') {
      // 검사지 범위는 대개 비임신 성인 기준 → 임신 기준으로는 정상일 수 있다. 이게 이 앱의 존재 이유.
      flagExplainedByPregnancy = true;
      const rangeText = printedCtx
        ? `${printedCtx.lower ?? ''}~${printedCtx.upper ?? ''}`.replace(/^~|~$/, '')
        : '';
      const note = `검사지에는 낮거나 높음으로 표시돼 있지만(검사지 기준 ${rangeText}), 이 기준은 임신하지 않은 성인 기준인 경우가 많습니다. ${basis.uiLabel}(${basis.lower ?? ''}~${basis.upper ?? ''})으로는 범위 안입니다.`;
      if (printedCtx) printedCtx.contrastNote = note;
      caveats.push(note);
    } else {
      flagMismatch = true;
      notes.push(`검사실은 이 항목에 '${row.flag}'(비정상) 표시를 했는데 앱 기준으로는 범위 안입니다. 검사지를 다시 확인해 주세요.`);
    }
  }

  // 심각도 상한 — 과잉 경고 방지 (예: anti-HBs 음성은 'watch'를 넘지 않는다)
  if (item.severityCap && severity(status) > severity(item.severityCap)) {
    status = item.severityCap;
  }

  // 검사지 참고범위가 없을 때는 임신 주수별 참고구간으로 자릿수 오독을 의심해 본다.
  // 중요: 여기서 status를 낮추지 않는다. 혈소판 36.2가 진짜라면 응급 상황이므로,
  // "오독일 수도 있다"는 이유로 경고를 지우면 안 된다. 경고는 그대로 두고 확인만 요청한다.
  let possibleMisread = false;
  if (value !== undefined && !row.printedRange && item.referenceIntervals && trimester) {
    const [lo, hi] = item.referenceIntervals[trimester];
    const farBelow = value < lo / 3;
    const farAbove = value > hi * 3;
    if (farBelow || farAbove) {
      for (const f of [10, 0.1, 100, 0.01]) {
        const v = Number((value * f).toPrecision(12));
        if (v >= lo * 0.9 && v <= hi * 1.1) {
          possibleMisread = true;
          caveats.push(
            `혹시 ${v}${item.unit ? ' ' + item.unit : ''}를 ${value}로 잘못 읽은 건 아닌지 확인해 주세요. ` +
            `숫자가 맞다면 위 안내대로 진료를 받으시고, 잘못 읽은 거라면 수정해 주세요.`,
          );
          notes.push(`참고구간(${lo}~${hi}) 대비 자릿수 오독 의심 → ${v} 가능성`);
          break;
        }
      }
    }
  }

  if (item.mandatoryCaveat) caveats.push(item.mandatoryCaveat.text);
  if (item.uncertaintyNote) caveats.push(item.uncertaintyNote.text);
  if (item.mandatoryCaveat?.sourceId) {
    const c = citationById(item.mandatoryCaveat.sourceId, item.mandatoryCaveat.quote);
    if (c) citations.push(c);
  }
  for (const sid of item.mandatoryCaveat?.sourceIds ?? []) {
    const c = citationById(sid); if (c) citations.push(c);
  }
  if (item.uncertaintyNote?.sourceId) {
    const c = citationById(item.uncertaintyNote.sourceId, item.uncertaintyNote.quote);
    if (c) citations.push(c);
  }

  // 중복 출처 제거
  citations = Array.from(new Map(citations.map((c) => [c.sourceId, c])).values());

  const judgment: Judgment = {
    itemId: item.id, itemName: item.name, status, label, message,
    value, grade, unit: item.unit, basis, printedRange: printedCtx, citations, caveats,
    dataQuality: { unitConverted, flagMismatch, flagExplainedByPregnancy, outOfPlausibleRange, needsUserConfirmation: possibleMisread, notes },
  };

  // 추세(개인화)
  const prev = (ctx.previousResults ?? []).filter((p) => p.itemId === item.id).sort((a, b) => b.testedAt.localeCompare(a.testedAt))[0];
  if (prev && value !== undefined) judgment.trend = computeTrend(value, prev.value, prev.testedAt, item);

  return judgment;
}

// ---------- 미지원 항목: 검사지에 인쇄된 참고범위만으로 판정 ----------
//
// 우리 기준표에 없는 항목(호중구 비율, RDW, 적혈구수 …)이라도 검사지에 참고범위가
// 인쇄돼 있으면 그 범위로는 판정할 수 있다. 표에서 통째로 사라지게 두는 것보다
// "검사지 기준으로는 범위 안"이라고 말해주는 편이 훨씬 낫다.
// 단, 임신 중 별도 기준이 없다는 사실은 반드시 함께 밝힌다.

/** 값이 참고범위 대비 10의 거듭제곱만큼 어긋났는지 — OCR 자릿수 오독의 전형적 신호 */
export function detectScaleMisread(
  value: number,
  lower?: number,
  upper?: number,
): { suspect: boolean; suggestion?: number } {
  if (lower === undefined && upper === undefined) return { suspect: false };
  const lo = lower ?? -Infinity;
  const hi = upper ?? Infinity;
  if (value >= lo && value <= hi) return { suspect: false };
  for (const f of [10, 0.1, 100, 0.01, 1000, 0.001]) {
    const v = Number((value * f).toPrecision(12));
    if (v >= lo && v <= hi) return { suspect: true, suggestion: v };
  }
  return { suspect: false };
}

export function evaluateByPrintedRange(row: ExtractedRow): Judgment | null {
  if (row.uncertain) {
    return {
      itemId: `printed:${row.rawName}`, itemName: row.rawName, status: 'indeterminate',
      label: '확인 필요', message: `${row.uncertain} 어느 쪽이 맞는지 확인되면 판정해 드릴게요.`,
      value: row.value, unit: row.unit,
      basis: { kind: 'none', uiLabel: '판정 안 함' },
      citations: [], caveats: [],
      dataQuality: { needsUserConfirmation: true, notes: [row.uncertain] },
    };
  }
  const pr = row.printedRange;
  if (!pr || row.value === undefined) return null;
  if (pr.lower === undefined && pr.upper === undefined) return null;

  const value = row.value;
  const rangeText = `${pr.lower ?? ''}~${pr.upper ?? ''}`.replace(/^~|~$/, '');
  const basis: RangeBasis = {
    kind: 'printed_lab_range',
    uiLabel: '내 검사지에 적힌 기준',
    lower: pr.lower,
    upper: pr.upper,
  };
  const citation: Citation = {
    sourceId: 'printed_lab_range',
    label: '검사지에 인쇄된 참고범위 (검사기관 제공)',
    url: '',
    quote: pr.raw,
    trustTier: 'A',
    verification: 'primary_verified',
  };

  // (1) 자릿수 오독 감지 — 판정보다 먼저. 잘못 읽은 값을 판정하면 안 된다.
  const scale = detectScaleMisread(value, pr.lower, pr.upper);
  if (scale.suspect) {
    return {
      itemId: `printed:${row.rawName}`,
      itemName: row.rawName,
      status: 'indeterminate',
      label: '확인 필요',
      message: `검사지에 적힌 참고범위(${rangeText})와 자릿수가 맞지 않아 판정을 보류했어요. 혹시 ${scale.suggestion}${row.unit ? ' ' + row.unit : ''}인가요? 사진이 흐리면 숫자를 잘못 읽을 수 있어요.`,
      value,
      unit: row.unit,
      basis,
      printedRange: { lower: pr.lower, upper: pr.upper, raw: pr.raw, outsidePrinted: true },
      citations: [citation],
      caveats: ['잘못 읽은 값으로 판정하지 않기 위해 일부러 판정을 멈춘 항목이에요.'],
      dataQuality: {
        outOfPlausibleRange: true,
        needsUserConfirmation: true,
        notes: [`읽은 값 ${value}이(가) 참고범위 ${rangeText}와 10의 거듭제곱만큼 어긋남 → ${scale.suggestion} 가능성`],
      },
    };
  }

  // (2) 검사지 범위 기준 판정
  const above = pr.upper !== undefined && value > pr.upper;
  const below = pr.lower !== undefined && value < pr.lower;
  const outside = above || below;
  const notes: string[] = [];
  // 범위를 크게 벗어나면 판정은 하되 숫자 확인을 권한다(진짜 이상치일 수 있으니 숨기지 않는다).
  if ((above && pr.upper !== undefined && value > pr.upper * 2) ||
      (below && pr.lower !== undefined && value < pr.lower / 2)) {
    notes.push('참고범위를 크게 벗어난 값이에요. 검사지의 숫자를 한 번 확인해 주세요.');
  }

  return {
    itemId: `printed:${row.rawName}`,
    itemName: row.rawName,
    status: outside ? 'watch' : 'safe',
    label: outside ? (above ? '기준보다 높음' : '기준보다 낮음') : '검사지 기준 정상',
    message: outside
      ? `검사지에 적힌 참고범위(${rangeText})를 벗어났어요. 다음 진료 때 확인해 보세요.`
      : `검사지에 적힌 참고범위(${rangeText}) 안에 있어요.`,
    value,
    unit: row.unit,
    basis,
    printedRange: { lower: pr.lower, upper: pr.upper, raw: pr.raw, outsidePrinted: outside },
    citations: [citation],
    caveats: ['이 항목은 임신 중 별도 기준이 정해져 있지 않아, 검사지에 인쇄된 기준으로만 보여드려요.'],
    dataQuality: { needsUserConfirmation: false, notes },
  };
}

// ---------- 추세 판정 ----------

const TREND_SIGNIFICANT_PCT: Record<string, number> = {
  hemoglobin: 10, ferritin: 30, platelet: 25, tsh: 50, creatinine: 40, alt: 50, ast: 50,
};

export function computeTrend(current: number, previous: number, previousDate: string, item: LabItem) {
  const delta = current - previous;
  const deltaPercent = previous !== 0 ? (delta / previous) * 100 : 0;
  const threshold = TREND_SIGNIFICANT_PCT[item.id] ?? 30;
  const significant = Math.abs(deltaPercent) >= threshold;
  const direction: 'up' | 'down' | 'flat' = Math.abs(deltaPercent) < 3 ? 'flat' : delta > 0 ? 'up' : 'down';
  let message: string | undefined;
  if (significant) {
    const dir = direction === 'down' ? '떨어졌' : '올라갔';
    message = `이전 검사(${previousDate}) ${previous} ${item.unit}에서 ${Math.abs(delta).toFixed(1)} ${dir}습니다. 수치 자체는 기준 안이더라도 변화 폭이 커서, 다음 진료 때 이 변화를 말씀해 보세요.`;
  }
  return { previousValue: previous, previousDate, delta, deltaPercent, direction, significant, message };
}

// ---------- 조합 규칙 ----------

function evaluateCrossRules(judgments: Judgment[], ctx: UserContext) {
  const findings: EvaluationResult['crossFindings'] = [];
  const byId = new Map(judgments.map((j) => [j.itemId, j]));
  const gw = ctx.gestationalWeek ?? 0;

  // 1) 전자간증 중증 소견
  const pre = referenceData.crossRules.find((r) => r.id === 'preeclampsia_severe_features');
  if (pre && gw >= 20) {
    const matchedConditions: string[] = [];
    const bp = ctx.bloodPressure;
    if (bp && (bp.systolic >= 160 || bp.diastolic >= 110)) matchedConditions.push(`혈압 ${bp.systolic}/${bp.diastolic} mmHg (160/110 이상)`);
    const plt = byId.get('platelet');
    if (plt?.value !== undefined && plt.value < 100) matchedConditions.push(`혈소판 ${plt.value} (10만 미만)`);
    for (const id of ['alt', 'ast']) {
      const j = byId.get(id);
      if (j && j.status === 'alert') matchedConditions.push(`${j.itemName} 정상 상한의 2배 이상`);
    }
    const cr = byId.get('creatinine');
    if (cr?.value !== undefined && cr.value > 1.1) matchedConditions.push(`크레아티닌 ${cr.value} (1.1 초과)`);
    for (const s of ctx.symptoms ?? []) {
      if (['두통', '시야이상', '시야 이상', '폐부종', '상복부통증'].includes(s)) matchedConditions.push(`증상: ${s}`);
    }
    if (matchedConditions.length > 0) {
      findings.push({
        ruleId: pre.id, name: pre.name, status: 'alert', message: pre.message,
        matchedConditions, citations: toCitations(pre.sources),
      });
    }
  }

  // 2) 빈혈 전 단계 철 결핍
  const idwa = referenceData.crossRules.find((r) => r.id === 'iron_deficiency_without_anemia');
  const hb = byId.get('hemoglobin');
  const fer = byId.get('ferritin');
  if (idwa && hb && fer && hb.status === 'safe' && fer.value !== undefined && fer.value < 30) {
    findings.push({
      ruleId: idwa.id, name: idwa.name, status: 'watch', message: idwa.message,
      matchedConditions: [`헤모글로빈 ${hb.value} (정상)`, `페리틴 ${fer.value} (30 미만)`],
      citations: toCitations(idwa.sources),
    });
  }

  // 3) B형간염 감수성 (HBsAg 음성 + anti-HBs 음성)
  const hbv = referenceData.crossRules.find((r) => r.id === 'hbv_susceptible');
  const ag = byId.get('hbsag');
  const ab = byId.get('anti_hbs');
  if (hbv && ag && ab && ag.status === 'safe' && ab.status === 'watch') {
    findings.push({
      ruleId: hbv.id, name: hbv.name, status: 'watch', message: hbv.message,
      matchedConditions: ['표면항원(HBsAg) 음성', '표면항체(anti-HBs) 음성'],
      citations: toCitations(hbv.sources),
    });
  }

  return findings;
}

// ---------- 엔트리포인트 ----------

export function evaluate(inputRows: ExtractedRow[], ctx: UserContext): EvaluationResult {
  const judgments: Judgment[] = [];
  const unsupported: EvaluationResult['unsupported'] = [];

  // 같은 항목이 여러 번 읽힌 경우를 먼저 정리한다. 판정보다 앞에 둬야
  // 중복된 경고가 화면에 여러 번 뜨는 일을 막을 수 있다.
  const indexed = inputRows.map((r, i) => ({ ...r, sourceIndex: r.sourceIndex ?? i }));
  const { rows, removedDuplicates, conflicting } = dedupeRows(indexed);

  for (const row of rows) {
    const r = evaluateRow(row, ctx);
    const stamp = (j: Judgment): Judgment => ({
      ...j,
      sourceIndex: row.sourceIndex,
      sourceName: row.rawName,
      sourceValue: row.rawValue,
    });
    if ('unsupported' in r) {
      // 우리 기준표에 없는 항목이라도 검사지에 참고범위가 있으면 그것으로 판정한다.
      const fallback = evaluateByPrintedRange(row);
      if (fallback) {
        judgments.push(stamp(fallback));
      } else if (row.value !== undefined || row.rawValue) {
        // 참고범위도 없고 우리 기준표에도 없는 항목. 그래도 검사지에 찍혀 있는 값이므로
        // 표에서 지우지 않는다 — 사용자는 종이에 있는 항목이 앱에 없으면 불안해한다.
        // 대신 판정은 하지 않고 "기준 없음"으로 값만 보여준다.
        judgments.push(stamp({
          itemId: `raw:${row.rawName}`,
          // 화면에는 긴 원문 대신 핵심 이름만 보여준다("…_적혈구수" → "적혈구수").
          itemName: coreName(row.rawName) || row.rawName,
          status: 'info_only',
          label: '기준 없음',
          message: '검사지에 참고범위가 없고 임신 중 별도 기준도 정해져 있지 않아, 값만 그대로 보여드려요. 판정은 하지 않습니다.',
          value: row.value,
          unit: row.unit,
          basis: { kind: 'none', uiLabel: '판정 안 함' },
          citations: [],
          caveats: [],
          dataQuality: { needsUserConfirmation: false, notes: [] },
        }));
        unsupported.push({ rawName: r.rawName, rawValue: r.rawValue, reason: r.reason });
      } else {
        unsupported.push({ rawName: r.rawName, rawValue: r.rawValue, reason: r.reason });
      }
    } else {
      judgments.push(stamp(r));
    }
  }

  // 이름이 달라도(예: "B형간염 표면항원"과 "HBsAg") 같은 검사 항목으로 매칭됐다면 중복이다.
  // dedupeRows는 이름 기준이라 여기서 한 번 더 거른다.
  const byItem = new Map<string, Judgment>();
  const merged: Judgment[] = [];
  for (const j of judgments) {
    // 우리가 모르는 항목(raw:/printed:)은 서로 다른 검사일 수 있으니 합치지 않는다.
    if (j.itemId.startsWith('raw:') || j.itemId.startsWith('printed:')) {
      merged.push(j);
      continue;
    }
    const prev = byItem.get(j.itemId);
    if (!prev) {
      byItem.set(j.itemId, j);
      merged.push(j);
      continue;
    }
    // 정성 결과(양성/음성)는 value·grade가 비어 있어서 원문 값으로 비교해야 한다.
    const key = (x: Judgment) =>
      String(x.value ?? x.grade ?? x.sourceValue ?? '').trim().toLowerCase();
    const sameValue = key(prev) === key(j);
    if (sameValue) continue; // 똑같은 값이 두 번 읽힌 것 — 하나만 남긴다

    // 값이 다르다고 바로 판정을 거두면 안 된다. 둘 중 한쪽이 명백히 더 신뢰할 만한
    // 경우(단위가 맞고, 가능한 범위 안이고, 이미 판정이 선 쪽)가 대부분이기 때문이다.
    // 예전에는 무조건 보류로 만들어서, 이름이 비슷한 부수 지표 한 줄 때문에 멀쩡한
    // 혈액 항목이 통째로 '확인 필요'가 됐다.
    const better = fitness(j) - fitness(prev);
    if (better > 0) {
      // j가 더 믿을 만하다 — 배열 위치는 유지한 채 내용만 교체한다.
      Object.assign(prev, j);
      continue;
    }
    if (better < 0) continue; // prev가 더 믿을 만하다 — 그대로 둔다

    // 정말 우열을 가릴 수 없을 때만 판정을 거둔다.
    prev.status = 'indeterminate';
    prev.label = '확인 필요';
    prev.message = `같은 항목이 서로 다른 값으로 읽혔어요 (${key(prev)} / ${key(j)}). 검사지의 값을 확인해 주세요.`;
    prev.citations = [];
    prev.dataQuality = { ...prev.dataQuality, needsUserConfirmation: true };
  }

  merged.sort((a, b) => severity(b.status) - severity(a.status));

  return {
    judgments: merged,
    crossFindings: evaluateCrossRules(merged, ctx),
    unsupported,
    meta: {
      dataVersion: referenceData.schema_version,
      dataUpdatedAt: referenceData.updated_at,
      evaluatedAt: new Date().toISOString(),
      trimester: ctx.trimester ?? trimesterOf(ctx.gestationalWeek),
      gestationalWeek: ctx.gestationalWeek,
      removedDuplicates,
      conflictingDuplicates: conflicting,
    },
  };
}
