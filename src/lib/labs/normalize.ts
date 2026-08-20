// lib/labs/normalize.ts
// 항목명 정규화 + 단위 환산.
// 억지 매칭이 오판정의 가장 큰 원인이므로, 확신이 없으면 매칭하지 않고 unsupported로 돌려보낸다.

import type { LabItem, ExtractedRow, Trimester } from './types';

/** 전각/공백/괄호/기호 제거 후 소문자화 */
export function normalizeKey(s: string): string {
  // Hermes(React Native) 일부 빌드에는 String.prototype.normalize가 없다.
  const base = typeof (s as any).normalize === 'function' ? s.normalize('NFKC') : s;
  return base
    .toLowerCase()
    .replace(/[\s ]/g, '')
    .replace(/[()[\]{}<>·・:：,，.]/g, '')
    .replace(/[-_/\\]/g, '')
    .trim();
}

/**
 * 검사지 항목명에서 "핵심 이름"만 뽑는다.
 *   "일반혈액검사(CBC)-[혈구세포-장비측정]_백혈구수" → "백혈구수"
 *   "혈색소[광전비색법]"                              → "혈색소"
 *   "AST (SGOT) [화학반응-장비측정]"                   → "AST (SGOT)"
 * 한국 검사지는 항목명 앞에 그룹·측정법을 길게 붙이는 경우가 많아서,
 * 이 과정을 거치지 않으면 아는 항목도 못 알아본다.
 */
export function coreName(raw: string): string {
  let t = raw.trim();
  // "_" 뒤가 실제 항목명인 경우가 많다
  if (t.includes('_')) t = t.split('_').pop()!.trim();
  // 측정법 등을 적어둔 대괄호는 떼어낸다
  t = t.replace(/\[[^\]]*\]/g, ' ').trim();
  // 앞머리에 "일반혈액검사(CBC)-" 같은 그룹명이 남아 있으면 마지막 조각을 쓴다
  if (/-/.test(t) && t.length > 12) {
    const last = t.split('-').pop()!.trim();
    if (last.length >= 2) t = last;
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * 별칭 뒤에 이게 붙어 있으면 "같은 이름의 다른 검사"다 — 부분포함 매칭에서 제외한다.
 * (normalizeKey를 통과한 뒤의 형태로 적는다: 소문자·공백/괄호 제거)
 */
const DISCRIMINATORS = [
  'igm', 'iga', 'ige',                 // 항체 클래스가 다르면 다른 검사다
  'mpv', 'pdw', 'pct', 'plcr',         // 혈소판 수가 아니라 부수 지표
  'width', 'distribution', '분포', '폭', '용적', '부피',
  'ratio', '비율', '지수', 'index',
  'sd', 'cv', '편차', '변동',
];

/**
 * 현미경 계수 단위. 요침사의 'WBC 0-3 /HPF'는 혈액 백혈구와 이름만 같을 뿐
 * 완전히 다른 검사인데, 별칭이 정확히 'wbc'라 exact 매칭에 그대로 걸린다.
 * 단위로 검체를 구분해 잘못 붙는 것을 막는다.
 */
const MICROSCOPY_UNITS = ['hpf', 'lpf', 'ul현미경'];

export function isMicroscopyUnit(unit?: string): boolean {
  if (!unit) return false;
  const u = normalizeKey(unit);
  return MICROSCOPY_UNITS.some((m) => u.includes(m));
}

export interface MatchResult {
  item: LabItem | null;
  matchType: 'exact' | 'normalized' | 'contains' | 'none';
  reason?: string;
}

/**
 * 3단 매칭: 정확 → 정규화 → 부분포함(길이 4자 이상일 때만).
 * 임베딩 유사도는 여기서 쓰지 않는다. 쓰더라도 임계값 미만이면 반드시 none을 반환할 것.
 */
export function matchItem(rawName: string, items: LabItem[]): MatchResult {
  const raw = rawName.trim();
  const key = normalizeKey(raw);
  if (!key) return { item: null, matchType: 'none', reason: '항목명이 비어 있음' };

  for (const item of items) {
    if (item.aliases.some((a) => a.trim().toLowerCase() === raw.toLowerCase())) {
      return { item, matchType: 'exact' };
    }
  }
  for (const item of items) {
    if (item.aliases.some((a) => normalizeKey(a) === key)) {
      return { item, matchType: 'normalized' };
    }
  }
  // 그룹명·측정법이 붙은 긴 이름은 핵심 이름만 떼어 다시 시도한다.
  const core = coreName(raw);
  if (core && core !== raw) {
    const ck = normalizeKey(core);
    for (const item of items) {
      if (item.aliases.some((a) => normalizeKey(a) === ck)) {
        return { item, matchType: 'normalized' };
      }
    }
  }

  // 부분포함 매칭은 "같은 검사인데 이름만 다르게 적힌 경우"를 잡으라고 둔 것이지,
  // "이름이 겹치는 다른 검사"까지 끌어오라는 게 아니다. 실제 검사지에서 이렇게 잘못 붙었다:
  //   풍진항체(IgM)               → rubella_igg  (IgG와 IgM은 다른 검사)
  //   Platelet Distribution Width → platelet     (혈소판 수가 아니라 분포폭)
  // 잘못 붙으면 판정이 틀리는 데서 끝나지 않는다. 같은 itemId가 두 개 생겨서
  // evaluate의 중복 병합이 "같은 항목이 다른 값으로 읽혔다"고 보고 멀쩡한 항목의
  // 판정까지 거둬버린다(→ 화면 전체가 '확인 필요'로 덮인다).
  if (key.length >= 4) {
    const hits = new Map<string, LabItem>();
    for (const item of items) {
      for (const a of item.aliases) {
        const ak = normalizeKey(a);
        if (ak.length < 4) continue;
        if (!key.includes(ak) && !ak.includes(key)) continue;
        // 별칭을 뺀 나머지에 '다른 검사임을 뜻하는 말'이 남아 있으면 붙이지 않는다.
        const leftover = key.length >= ak.length ? key.split(ak).join('') : '';
        if (DISCRIMINATORS.some((d) => leftover.includes(d))) continue;
        hits.set(item.id, item);
      }
    }
    // 후보가 둘 이상이면 어느 쪽인지 확신할 수 없으므로 매칭하지 않는다.
    if (hits.size === 1) {
      return { item: Array.from(hits.values())[0], matchType: 'contains' };
    }
    if (hits.size > 1) {
      return {
        item: null, matchType: 'none',
        reason: `'${raw}'이(가) 여러 항목(${Array.from(hits.keys()).join(', ')})에 걸쳐 매칭돼 판정하지 않음`,
      };
    }
  }
  return { item: null, matchType: 'none', reason: `'${raw}'에 해당하는 항목을 찾지 못함` };
}

/** 0.1 * 112 = 11.200000000000001 같은 부동소수점 오차 제거 */
export function roundFloat(v: number, sig = 12): number {
  return Number(Number(v).toPrecision(sig));
}

export interface UnitConversion {
  value: number;
  converted: boolean;
  from?: string;
  factor?: number;
  error?: string;
}

const SUPERSCRIPT: Record<string, string> = {
  '\u2070': '0', '\u00B9': '1', '\u00B2': '2', '\u00B3': '3', '\u2074': '4',
  '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9',
  '\u207B': '-',
};

/**
 * 단위 표기를 하나로 맞춘다.
 *
 * 검사지(와 그걸 읽은 OCR)는 같은 단위를 제각각 적는다:
 *   10^3/uL · 10^3/µL · 10³/μL · x10^3/uL · 10E3/uL · ㎕
 * 기준표에는 'uL' 한 가지로만 적혀 있어서, µ(U+00B5)나 μ(U+03BC)가 섞여 들어오면
 * convertUnit이 "알 수 없는 단위"로 판정을 보류해 버렸다. 실제로 혈소판이
 * '10^3/µL'로 읽히는 바람에 멀쩡한 값이 계속 '확인 필요'로 떴다.
 *
 * 주의: NFKC는 위첨자 ³을 그냥 '3'으로 바꿔 '10³'을 '103'으로 만들어 버린다.
 * 그래서 위첨자를 '^3'으로 먼저 펴고 나서 NFKC를 태운다.
 */
export function normalizeUnit(raw: string): string {
  let u = (raw ?? '').trim();
  if (!u) return '';

  // 1) 위첨자 → ^n  ("10³" → "10^3").  NFKC보다 반드시 먼저.
  u = u.replace(/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079\u207B]+/g, (m) =>
    '^' + Array.from(m).map((c) => SUPERSCRIPT[c] ?? '').join(''),
  );

  // 2) 호환 문자 정규화 (㎕ → μl 등). Hermes에 normalize가 없는 빌드가 있다.
  if (typeof (u as any).normalize === 'function') u = u.normalize('NFKC');

  u = u.toLowerCase();

  // 3) 마이크로 기호 통일: µ(U+00B5) · μ(U+03BC) → u
  u = u.replace(/[\u00B5\u03BC]/g, 'u');

  // 4) 곱셈 접두사 제거 ("x10^3/ul", "×10³/µl")
  u = u.replace(/^[x\u00D7*\u00B7]\s*/, '');

  // 5) 지수 표기 통일 ("10e3" → "10^3")
  u = u.replace(/(\d)e(\d)/g, '$1^$2');

  // 6) 공백·쉼표·괄호 제거, 맨 앞 '/'는 떼어낸다("/uL"과 "uL"을 같게 본다)
  u = u.replace(/[\s,()]/g, '').replace(/^\//, '');

  return u;
}

/** 검사지 단위를 항목 표준 단위로 환산. 모르는 단위면 환산하지 않고 error를 남긴다. */
export function convertUnit(value: number, unit: string | undefined, item: LabItem): UnitConversion {
  if (!unit) return { value, converted: false };
  const u = unit.trim();
  const std = item.unit.trim();
  const key = normalizeUnit(u);
  if (key === normalizeUnit(std)) return { value, converted: false };

  const aliases = item.unitAliases ?? {};
  for (const [k, factor] of Object.entries(aliases)) {
    if (normalizeUnit(k) === key) {
      return { value: roundFloat(value * factor), converted: true, from: u, factor };
    }
  }
  return { value, converted: false, error: `알 수 없는 단위 '${u}' (표준 단위: ${std})` };
}

/** 자릿수 sanity check — Hb 110처럼 g/L 단위를 g/dL로 오독한 경우를 잡는다. */
export function checkPlausible(value: number, item: LabItem): { ok: boolean; suggestion?: number; note?: string } {
  if (!item.plausibleRange) return { ok: true };
  const [lo, hi] = item.plausibleRange;
  if (value >= lo && value <= hi) return { ok: true };

  for (const factor of [0.1, 10, 0.001, 1000, 0.01, 100]) {
    const v = value * factor;
    if (v >= lo && v <= hi) {
      return {
        ok: false,
        suggestion: v,
        note: `입력값 ${value}이(가) ${item.name}의 가능한 범위(${lo}~${hi} ${item.unit})를 벗어남. 단위 오독으로 보이며 ${v}일 가능성이 있음.`,
      };
    }
  }
  return { ok: false, note: `입력값 ${value}이(가) ${item.name}의 가능한 범위(${lo}~${hi} ${item.unit})를 벗어남.` };
}

export function trimesterOf(gestationalWeek?: number): Trimester | undefined {
  if (gestationalWeek === undefined || Number.isNaN(gestationalWeek)) return undefined;
  if (gestationalWeek <= 13) return 'T1';
  if (gestationalWeek <= 27) return 'T2';
  return 'T3';
}

/** 검사지에 인쇄된 참고범위 문자열 파싱. "11.0 - 15.0", "11.0~15.0", "<5.0", "0.4-4.1" 등 */
export function parsePrintedRange(raw: string): { lower?: number; upper?: number; raw: string } | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/\s/g, '').replace(/[–—−]/g, '-');
  let m = s.match(/^(-?\d+(?:\.\d+)?)[-~](-?\d+(?:\.\d+)?)$/);
  if (m) return { lower: parseFloat(m[1]), upper: parseFloat(m[2]), raw };
  m = s.match(/^[<≤](-?\d+(?:\.\d+)?)$/);
  if (m) return { upper: parseFloat(m[1]), raw };
  m = s.match(/^[>≥](-?\d+(?:\.\d+)?)$/);
  if (m) return { lower: parseFloat(m[1]), raw };
  return undefined;
}

/** 등급 문자열 정규화: "음성", "negative", "-", "±", "1+", "+1" 등 */
export function normalizeGrade(raw: string, scale: string[]): string | undefined {
  const s = raw.trim().toLowerCase().replace(/\s/g, '');
  const map: Record<string, string> = {
    '-': '음성', 'negative': '음성', 'neg': '음성', '음성': '음성', '0': '음성',
    '±': 'trace', '+-': 'trace', 'trace': 'trace', '미량': 'trace',
    '+': '1+', '1+': '1+', '+1': '1+',
    '++': '2+', '2+': '2+', '+2': '2+',
    '+++': '3+', '3+': '3+', '+3': '3+',
    '++++': '4+', '4+': '4+', '+4': '4+',
  };
  const v = map[s];
  return v && scale.includes(v) ? v : undefined;
}

/** 결과값이 비어 있는가 ('-', '', 'N/A', '미검', '검사안함' 등) — 이런 건 절대 판정하지 않는다 */
export function isEmptyValue(raw: string | undefined): boolean {
  if (raw === undefined || raw === null) return true;
  const s = raw.trim().toLowerCase().replace(/\s/g, '');
  return ['', '-', '--', '.', 'na', 'n/a', 'nd', 'none', '미검', '미시행', '검사안함', '해당없음', '결과없음'].includes(s);
}

export function normalizeQualitative(raw: string, extra?: Record<string, string>): 'positive' | 'negative' | undefined {
  const s = raw.trim().toLowerCase().replace(/\s/g, '');
  // 검사지는 정성 결과 옆에 측정치를 괄호로 덧붙이는 경우가 많다
  // ("음성(4.80)", "양성(>500)"). 괄호를 떼기 전 형태로 먼저 맞춰보고,
  // 안 맞으면 뗀 형태로 한 번 더 본다. 이걸 안 하면 멀쩡한 음성/양성 결과가
  // '해석하지 못했습니다'로 떨어져 판정이 통째로 보류된다.
  const stripped = s.replace(/\([^)]*\)/g, '').trim();
  const forms = stripped && stripped !== s ? [s, stripped] : [s];

  for (const f of forms) {
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (k.toLowerCase().replace(/\s/g, '') === f) return v as 'positive' | 'negative';
      }
    }
    // 주의: '-'는 여기서 음성으로 해석하지 않는다. 검사지에서 '-'는 '결과 없음'인 경우가 더 많다.
    if (['음성', 'negative', 'neg', 'nonreactive', 'non-reactive', '비반응'].includes(f)) return 'negative';
    if (['양성', 'positive', 'pos', '+', 'reactive', '반응'].includes(f)) return 'positive';
  }
  return undefined;
}

export type { ExtractedRow };

/**
 * 서버/구버전이 한 덩어리 문자열로 내려주는 결과값을 쪼갠다.
 *   "3.79 % (33~44)"       → { value: 3.79, unit: "%", printedRange: {33, 44} }
 *   "12.2 10^4/µL (3.5~5)" → { value: 12.2, unit: "10^4/µL", printedRange: {3.5, 5} }
 *   "음성(4.80)"            → { qualitative: "negative", value: 4.80 }
 *   "NR"                   → { qualitative: "negative" }
 * 검사지 참고범위를 문자열 안에 이미 갖고 있는 경우가 많아서, 이걸 살려내면
 * 지난 검사지(서버에서 불러온 것)에도 판정 엔진을 그대로 태울 수 있다.
 */
export function parseValueString(raw: string): {
  value?: number;
  unit?: string;
  printedRange?: { lower?: number; upper?: number; raw: string };
  qualitative?: 'positive' | 'negative';
} {
  const text = (raw ?? '').trim();
  if (!text || isEmptyValue(text)) return {};

  // 괄호 안이 참고범위인지(숫자~숫자) 아니면 정성 결과의 수치인지 구분한다.
  let printedRange: { lower?: number; upper?: number; raw: string } | undefined;
  let parenNumber: number | undefined;
  const paren = text.match(/\(([^)]*)\)/);
  if (paren) {
    const inner = paren[1].trim();
    const asRange = parsePrintedRange(inner);
    if (asRange && (asRange.lower !== undefined || asRange.upper !== undefined)) {
      // "33~44"처럼 두 숫자면 참고범위, "4.80"처럼 하나면 수치로 본다.
      if (/[-~<>≤≥]/.test(inner)) printedRange = asRange;
      else parenNumber = parseFloat(inner);
    } else if (/^-?\d+(\.\d+)?$/.test(inner)) {
      parenNumber = parseFloat(inner);
    }
  }

  const head = text.replace(/\([^)]*\)/g, '').trim();
  const qualitative = normalizeQualitative(head);
  const numMatch = head.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);

  if (numMatch) {
    const unit = numMatch[2].trim();
    return {
      value: parseFloat(numMatch[1]),
      unit: unit || undefined,
      printedRange,
    };
  }
  return { qualitative, value: parenNumber, printedRange };
}

/**
 * 같은 항목이 여러 번 읽힌 것을 합친다.
 *
 * 비전 모델은 temperature를 0으로 두면 오히려 같은 줄을 반복해서 뱉는
 * 퇴행 루프(degenerate repetition)에 빠질 때가 있다. 사진이 흐리거나 표가
 * 길 때 특히 그렇다. 이걸 그대로 두면 "헤모글로빈 8.4 즉시 상담"이 화면에
 * 네 번 뜨고, 사용자는 네 번 겁먹는다.
 *
 * - 값까지 같으면      → 한 줄로 합친다 (모델의 반복)
 * - 값이 서로 다르면   → 한 줄로 합치되 판정하지 않는다 (어느 쪽이 맞는지 모름)
 */
export function dedupeRows(rows: ExtractedRow[]): {
  rows: ExtractedRow[];
  removedDuplicates: number;
  conflicting: string[];
} {
  const groups = new Map<string, ExtractedRow[]>();
  const order: string[] = [];
  for (const r of rows) {
    const key = normalizeKey(r.rawName);
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(r);
  }

  const out: ExtractedRow[] = [];
  let removedDuplicates = 0;
  const conflicting: string[] = [];

  for (const key of order) {
    const group = groups.get(key)!;
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    removedDuplicates += group.length - 1;

    const values = Array.from(new Set(group.map((g) => (g.rawValue ?? '').trim())));
    if (values.length === 1) {
      // 완전히 같은 줄이 반복된 것 — 첫 줄만 남긴다.
      out.push(group[0]);
      continue;
    }
    // 값이 갈렸다 — 어느 쪽이 맞는지 모르므로 판정하지 않고 사용자에게 묻는다.
    conflicting.push(group[0].rawName);
    out.push({
      ...group[0],
      uncertain: `같은 항목이 서로 다른 값으로 여러 번 읽혔어요 (${values.slice(0, 3).join(' / ')}).`,
    });
  }
  return { rows: out, removedDuplicates, conflicting };
}
