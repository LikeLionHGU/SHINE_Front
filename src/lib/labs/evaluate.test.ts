// src/lib/labs/evaluate.test.ts
//
// 판정 엔진 회귀 테스트. 실행:  npx tsx src/lib/labs/evaluate.test.ts
//
// 여기 있는 케이스는 대부분 "실제 앱 화면에서 발견된 버그"를 그대로 옮긴 것이다.
// 기준표(data/*.json)를 고치거나 엔진을 손볼 때 이 파일을 먼저 돌려서,
// 이미 잡은 문제가 되살아나지 않는지 확인할 것.
// 실행: npx tsx lib/labs/evaluate.test.ts  (또는 vitest/jest에 붙여도 됨)

import { evaluate, evaluateRow } from './evaluate';
import type { ExtractedRow, UserContext } from './types';
import { parseValueString } from './normalize';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`, detail ?? ''); }
}
function row(rawName: string, rawValue: string, extra: Partial<ExtractedRow> = {}): ExtractedRow {
  const n = parseFloat(rawValue);
  return { rawName, rawValue, value: Number.isFinite(n) ? n : undefined, ...extra };
}

console.log('\n=== 1. 삼분기별 헤모글로빈 경계값 ===');
{
  const t2: UserContext = { gestationalWeek: 20 };
  const t3: UserContext = { gestationalWeek: 30 };
  const a = evaluateRow(row('헤모글로빈', '10.6', { unit: 'g/dL' }), t2) as any;
  check('2분기 Hb 10.6 → safe (2분기 기준 10.5)', a.status === 'safe', a.status);
  const b = evaluateRow(row('헤모글로빈', '10.6', { unit: 'g/dL' }), t3) as any;
  check('3분기 Hb 10.6 → watch (3분기 기준 11.0)', b.status === 'watch', b.status);
  const c = evaluateRow(row('Hb', '9.8', { unit: 'g/dL' }), t3) as any;
  check('3분기 Hb 9.8 → alert (중등도)', c.status === 'alert', c.status);
  check('출처가 ACOG/WHO로 붙는다', b.citations.some((x: any) => x.sourceId === 'acog_pb233_2021'), b.citations);
  check('모든 판정에 출처가 1개 이상', b.citations.length > 0 && c.citations.length > 0);
}

console.log('\n=== 2. 단위 오독 방어 (g/L을 g/dL로 읽은 경우) ===');
{
  const j = evaluateRow(row('헤모글로빈', '112', { unit: 'g/L' }), { gestationalWeek: 24 }) as any;
  check('g/L → g/dL 자동 환산', j.value === 11.2, j.value);
  check('환산 사실이 dataQuality에 기록됨', !!j.dataQuality.unitConverted, j.dataQuality);
  const k = evaluateRow(row('헤모글로빈', '112'), { gestationalWeek: 24 }) as any;
  check('단위 없이 112 → 판정 보류(indeterminate)', k.status === 'indeterminate', k.status);
  check('11.2 아니냐고 되묻는다', k.dataQuality.notes.some((n: string) => n.includes('11.2')), k.dataQuality.notes);
}

console.log('\n=== 3. 페리틴 — 검사실 참고범위 vs 임상 기준 분리 ===');
{
  const j = evaluateRow(row('페리틴', '22', { unit: 'ng/mL', printedRange: { lower: 9, upper: 89, raw: '9-89' } }), { gestationalWeek: 26 }) as any;
  check('검사지 기준 정상(9~89)이어도 임상 기준으로 watch', j.status === 'watch', j.status);
  check('판정 기준이 학회 컷오프(30)로 표기됨', j.basis.kind === 'guideline_cutoff' && j.basis.lower === 30, j.basis);
  check('참고범위/임상기준 차이를 caveat으로 알림', j.caveats.some((c: string) => c.includes('검사실')), j.caveats);
  const k = evaluateRow(row('페리틴', '12', { unit: 'ng/mL' }), { gestationalWeek: 26 }) as any;
  check('페리틴 12 → alert', k.status === 'alert', k.status);
}

console.log('\n=== 4. TSH — 검사지 참고범위 1순위 ===');
{
  const withRange = evaluateRow(row('TSH', '5.5', { unit: 'mIU/L', printedRange: { lower: 0.4, upper: 7.0, raw: '0.40-7.00' } }), { gestationalWeek: 10 }) as any;
  check('검사지 상한 7.0 기준이면 5.5는 safe', withRange.status === 'safe', withRange.status);
  check('판정 기준이 검사지임을 명시', withRange.basis.kind === 'printed_lab_range', withRange.basis);
  const noRange = evaluateRow(row('TSH', '5.5', { unit: 'mIU/L' }), { gestationalWeek: 10 }) as any;
  check('검사지 범위 없으면 한국인 1분기 상한 4.10 적용 → recheck', noRange.status === 'recheck', noRange.status);
  check('"확정 아님, 4~6주 재검" 메시지', noRange.message.includes('재검'), noRange.message);
  check('ATA 2026 근거 인용', noRange.citations.some((c: any) => c.sourceId === 'ata_2026'), noRange.citations.map((c: any) => c.sourceId));
  const high = evaluateRow(row('TSH', '12', { unit: 'mIU/L' }), { gestationalWeek: 10 }) as any;
  check('TSH 12 → alert', high.status === 'alert', high.status);
}

console.log('\n=== 4-b. 검사지 범위가 비임신 기준일 때 (핵심 가치) ===');
{
  // 검사지에는 12.0~16.0 (비임신 성인 여성 기준)이 인쇄되고 L 표시가 찍혀 나옴
  const j = evaluateRow(row('헤모글로빈', '11.2', { unit: 'g/dL', printedRange: { lower: 12.0, upper: 16.0, raw: '12.0-16.0' }, flag: 'L' }), { gestationalWeek: 30 }) as any;
  check('임신 기준으로 판정한다 (검사지 범위를 그대로 쓰지 않음)', j.basis.kind === 'trimester_reference_interval', j.basis);
  check('임신 3분기 기준 11.0 이상 → safe', j.status === 'safe', j.status);
  check('검사지 L 표시를 "비임신 기준" 으로 설명', j.dataQuality.flagExplainedByPregnancy === true, j.dataQuality);
  check('대조 설명이 caveat에 들어감', j.caveats.some((c: string) => c.includes('임신하지 않은 성인 기준')), j.caveats);
  check('검사지 범위도 함께 반환', j.printedRange?.outsidePrinted === true, j.printedRange);
  check('safe여도 출처가 붙는다', j.citations.length > 0, j.citations);
}

console.log('\n=== 5. 풍진 IgG 회색지대 ===');
{
  const g = evaluateRow(row('풍진', '7.2', { unit: 'IU/mL' }), { gestationalWeek: 8 }) as any;
  check('7.2 → indeterminate (판정 보류)', g.status === 'indeterminate', g.status);
  check('검사법 편차 경고 포함', g.caveats.some((c: string) => c.includes('10배')), g.caveats);
  const im = evaluateRow(row('풍진', '45', { unit: 'IU/mL' }), { gestationalWeek: 8 }) as any;
  check('45 → safe (면역)', im.status === 'safe', im.status);
  const no = evaluateRow(row('풍진', '2.1', { unit: 'IU/mL' }), { gestationalWeek: 8 }) as any;
  check('2.1 → watch (면역 없음 가능)', no.status === 'watch', no.status);
}

console.log('\n=== 6. 요단백 등급 판정 ===');
{
  const p = evaluateRow(row('요단백', '2+'), { gestationalWeek: 32 }) as any;
  check('32주 요단백 2+ → alert', p.status === 'alert', p.status);
  const early = evaluateRow(row('요단백', '2+'), { gestationalWeek: 10 }) as any;
  check('10주 요단백 2+ → alert 아님(20주 가드)', early.status !== 'alert', early.status);
  const neg = evaluateRow(row('요단백', '음성'), { gestationalWeek: 32 }) as any;
  check('음성 → safe', neg.status === 'safe', neg.status);
  check('음성이어도 "단백뇨 없이도 진단 가능" caveat', neg.caveats.some((c: string) => c.includes('음성이어도')), neg.caveats);
}

console.log('\n=== 7. 조합 규칙 — 전자간증 중증 소견 ===');
{
  const res = evaluate(
    [row('혈소판', '88', { unit: '10^3/uL' }), row('요단백', '음성'), row('크레아티닌', '1.3', { unit: 'mg/dL' })],
    { gestationalWeek: 33, bloodPressure: { systolic: 158, diastolic: 98 } },
  );
  const f = res.crossFindings.find((x) => x.ruleId === 'preeclampsia_severe_features');
  check('단백뇨 음성이어도 조합으로 alert 발생', !!f, res.crossFindings);
  check('혈소판·크레아티닌 두 조건 모두 잡힘', (f?.matchedConditions.length ?? 0) >= 2, f?.matchedConditions);
  check('ACOG PB222 인용', f?.citations.some((c) => c.sourceId === 'acog_pb222_2020') ?? false, f?.citations);
}

console.log('\n=== 8. 조합 규칙 — 빈혈 없는 철 결핍 ===');
{
  const res = evaluate(
    [row('헤모글로빈', '11.8', { unit: 'g/dL' }), row('페리틴', '18', { unit: 'ng/mL' })],
    { gestationalWeek: 22 },
  );
  const f = res.crossFindings.find((x) => x.ruleId === 'iron_deficiency_without_anemia');
  check('Hb 정상 + 페리틴 18 → 빈혈 전 단계 감지', !!f, res.crossFindings);
}

console.log('\n=== 9. 추세(개인화) ===');
{
  const j = evaluateRow(row('헤모글로빈', '11.2', { unit: 'g/dL' }), {
    gestationalWeek: 28,
    previousResults: [{ itemId: 'hemoglobin', value: 13.5, testedAt: '2026-06-01' }],
  }) as any;
  check('둘 다 정상 범위지만 하락 폭을 감지', j.trend?.significant === true, j.trend);
  check('추세 메시지 생성', !!j.trend?.message, j.trend?.message);
}

console.log('\n=== 10. 미지원 항목은 조용히 빠지지 않는다 ===');
{
  const res = evaluate([row('아밀라아제', '80', { unit: 'U/L' })], { gestationalWeek: 20 });
  check('unsupported로 명시 기록', res.unsupported.length === 1, res.unsupported);
  // 정책 변경: 검사지에 찍힌 항목은 표에서 지우지 않는다. 대신 판정하지 않는다.
  // (종이에 있는 항목이 앱에 없으면 사용자는 앱을 못 믿는다.)
  check('표에는 남되 판정하지 않는다', res.judgments.length === 1 && res.judgments[0].status === 'info_only', res.judgments[0]?.status);
  check('기준 없음 항목엔 출처를 붙이지 않는다', res.judgments[0].citations.length === 0);
}

console.log('\n=== 11. H/L 플래그 대조 ===');
{
  // (a) 임신 기준으로 설명 가능한 경우 → 경고가 아니라 설명
  const a = evaluateRow(row('혈소판', '148', { unit: '10^3/uL', flag: 'L' }), { gestationalWeek: 30 }) as any;
  check('3분기 혈소판 148: 검사실 L 표시를 임신 기준으로 설명', a.dataQuality.flagExplainedByPregnancy === true, a.dataQuality);
  check('불필요한 경고를 띄우지 않음', a.dataQuality.flagMismatch !== true, a.dataQuality);
  // (b) 검사지 범위 자체가 판정 기준인데 어긋나면 진짜 OCR 의심
  const b = evaluateRow(row('TSH', '2.0', { unit: 'mIU/L', printedRange: { lower: 0.4, upper: 4.1, raw: '0.4-4.1' }, flag: 'H' }), { gestationalWeek: 12 }) as any;
  check('검사지 기준 안인데 H 표시 → OCR 불일치 경고', b.dataQuality.flagMismatch === true, b.dataQuality);
}

console.log('\n=== 12. 총콜레스테롤은 판정하지 않는다 ===');
{
  const j = evaluateRow(row('총콜레스테롤', '298', { unit: 'mg/dL' }), { gestationalWeek: 32 }) as any;
  check('info_only 반환', j.status === 'info_only', j.status);
  check('근거(메타분석) 인용', j.citations.some((c: any) => c.sourceId === 'rbe_2025_lipid'), j.citations);
}

console.log('\n=== 13. 당부하검사 패널 ===');
{
  const two: ExtractedRow = { rawName: '100g OGTT', rawValue: 'panel', panelValues: { fasting: 98, h1: 185, h2: 140, h3: 120 } };
  const j = evaluateRow(two, { gestationalWeek: 26 }) as any;
  check('4개 중 2개 초과 → alert', j.status === 'alert', j.status);
  const one: ExtractedRow = { rawName: '100g OGTT', rawValue: 'panel', panelValues: { fasting: 98, h1: 150, h2: 140, h3: 120 } };
  const k = evaluateRow(one, { gestationalWeek: 26 }) as any;
  check('1개만 초과 → watch (진단 아님)', k.status === 'watch', k.status);
}

console.log('\n=== 14. 모든 판정에 출처가 있는가 (전수 검사) ===');
{
  const cases: Array<[ExtractedRow, UserContext]> = [
    [row('헤모글로빈', '9.0', { unit: 'g/dL' }), { gestationalWeek: 30 }],
    [row('페리틴', '20', { unit: 'ng/mL' }), { gestationalWeek: 20 }],
    [row('TSH', '6.0', { unit: 'mIU/L' }), { gestationalWeek: 12 }],
    [row('크레아티닌', '1.4', { unit: 'mg/dL' }), { gestationalWeek: 30 }],
    [row('요단백', '3+'), { gestationalWeek: 34 }],
    [row('HBsAg', '양성'), { gestationalWeek: 12 }],
    [row('VDRL', '양성'), { gestationalWeek: 12 }],
    [row('혈소판', '90', { unit: '10^3/uL' }), { gestationalWeek: 30 }],
    [row('공복혈당', '130', { unit: 'mg/dL' }), { gestationalWeek: 10 }],
    [row('50g GCT', '150', { unit: 'mg/dL' }), { gestationalWeek: 26 }],
  ];
  let ok = true;
  for (const [r, c] of cases) {
    const j = evaluateRow(r, c) as any;
    if (!j.citations || j.citations.length === 0) { ok = false; console.log('    출처 없음:', r.rawName, j.status); }
  }
  check('비정상 판정 10건 모두 출처 보유', ok);
}


console.log('\n=== 15. 실제 앱 스크린샷에서 발견된 오판정 (v1 버그) ===');
{
  // (a) anti-HBs 음성을 '위험'으로 띄우던 버그
  const ab = evaluateRow(row('B형간염 표면항체', '음성'), { gestationalWeek: 20 }) as any;
  check('anti-HBs 음성 → alert 아님', ab.status !== 'alert', ab.status);
  check('anti-HBs 음성 → watch (예방접종 상담)', ab.status === 'watch', ab.status);
  check('"위험"이 아니라 조치 가능함을 안내', ab.message.includes('예방접종'), ab.message);
  check('CDC 근거 인용', ab.citations.some((c: any) => c.sourceId === 'cdc_hbv_2023'), ab.citations);
  check('항원/항체 차이를 고지', ab.caveats.some((c: string) => c.includes('항원')), ab.caveats);

  // (b) 결과값이 '-'인데 '안심'으로 띄우던 버그
  const empty = evaluateRow(row('요당', '-'), { gestationalWeek: 20 }) as any;
  check("요당 '-' → 안심으로 표시하지 않음", empty.status !== 'safe', empty.status);
  check("요당 '-' → 결과 없음", empty.label === '결과 없음', empty.label);
  const empty2 = evaluateRow(row('소변검사', '-'), { gestationalWeek: 20 }) as any;
  check("소변검사 '-' → 판정 안 함", ('unsupported' in empty2) || empty2.status === 'indeterminate', empty2);

  // (c) 매독 NR(non-reactive)을 못 읽어 배지가 안 나오던 문제
  const sy = evaluateRow(row('매독검사', 'NR'), { gestationalWeek: 20 }) as any;
  check("매독 'NR' → 음성으로 해석", sy.status === 'safe', sy.status);
  const hiv = evaluateRow(row('HIV검사', '음성'), { gestationalWeek: 20 }) as any;
  check('HIV 음성 → safe', hiv.status === 'safe', hiv.status);

  // (d) HBsAg 음성 + anti-HBs 음성 조합
  const res = evaluate([row('B형간염 표면항원', '음성'), row('B형간염 표면항체', '음성')], { gestationalWeek: 20 });
  const f = res.crossFindings.find((x) => x.ruleId === 'hbv_susceptible');
  check('두 항목 조합 → 예방접종 상담 안내', !!f, res.crossFindings);
}


console.log('\n=== 16. 실제 화면에서 발견된 문제 (미지원 항목 / 자릿수 오독) ===');
{
  const mk = (n: string, v: string) => { const p = parseValueString(v); return { rawName: n, rawValue: v, ...p, flag: 'N' }; };

  // (a) 기준표에 없는 CBC 분획 — 표에서 사라지지 않고 검사지 기준으로 판정된다
  const res = evaluate([mk('호중구 비율', '73.4 % (40~80)') as any], { gestationalWeek: 20 });
  check('호중구 비율: unsupported로 버리지 않음', res.unsupported.length === 0, res.unsupported);
  check('표에 남는다', res.judgments.length === 1 && res.unsupported.length === 0, res);
  check('검사지 기준으로 판정', res.judgments[0].basis.kind === 'printed_lab_range', res.judgments[0].basis);
  check('임신 기준 없음을 고지', res.judgments[0].caveats.some((c: string) => c.includes('임신 중 별도 기준')), res.judgments[0].caveats);
  check('출처가 붙는다', res.judgments[0].citations.length > 0);

  // (b) 헤마토크리트 3.79% — 생물학적으로 불가능. 판정하지 말고 되물어야 한다
  const hct = evaluateRow(mk('헤마토크리트', '3.79 % (33~44)') as any, { gestationalWeek: 20 }) as any;
  check('Hct 3.79 → 안심/미분류가 아니라 판정 보류', hct.status === 'indeterminate', hct.status);
  check('"혹시 37.9인가요?"로 되묻는다', hct.message.includes('37.9'), hct.message);
  check('"헤마토크리트"(t) 표기도 매칭됨', hct.itemId === 'hematocrit', hct.itemId);

  // (c) 참고범위를 크게 벗어난 값은 숨기지 않되 확인을 권한다
  const rbc = evaluate([mk('적혈구수', '12.2 10^4/µL (3.5~5)') as any], { gestationalWeek: 20 }).judgments[0];
  check('적혈구수 12.2 → 판정은 하되', rbc.status === 'watch', rbc.status);
  check('숫자 확인을 권한다', rbc.dataQuality.notes.some((n: string) => n.includes('확인')), rbc.dataQuality.notes);

  // (d) 서버 값 문자열 파싱
  const p1 = parseValueString('3.79 % (33~44)');
  check('"3.79 % (33~44)" 파싱', p1.value === 3.79 && p1.unit === '%' && p1.printedRange?.upper === 44, p1);
  const p2 = parseValueString('음성(4.80)');
  check('"음성(4.80)" 파싱', p2.qualitative === 'negative' && p2.value === 4.8, p2);
  const p3 = parseValueString('-');
  check('"-" 는 빈 값', p3.value === undefined && p3.qualitative === undefined, p3);
}

console.log(`\n----------------------------------------\n총 ${pass + fail}건 중 PASS ${pass} / FAIL ${fail}\n`);
if (fail > 0) (globalThis as any).process?.exit(1);

console.log('\n=== 17. 비전 모델 오독 방어 (교차검증 / 자릿수 / 단위) ===');
{
  // (a) 두 번 읽어서 값이 갈린 항목은 판정하지 않는다
  const conflicted = evaluateRow(
    { rawName: '헤모글로빈', rawValue: '11.2', value: 11.2, unit: 'g/dL',
      uncertain: '두 번 읽었을 때 값이 달랐어요 (11.2 / 17.2).' } as any,
    { gestationalWeek: 30 },
  ) as any;
  check('값이 갈리면 판정 보류', conflicted.status === 'indeterminate', conflicted.status);
  check('출처를 붙이지 않는다(틀린 값에 근거를 달지 않음)', conflicted.citations.length === 0);
  check('사용자 확인을 요구', conflicted.dataQuality.needsUserConfirmation === true);

  // (b) 자릿수 오독 — 참고범위 대비 10배
  const scaled = evaluate([{ rawName: '헤마토크리트', rawValue: '3.79', value: 3.79, unit: '%',
    printedRange: { lower: 33, upper: 44, raw: '33~44' } } as any], { gestationalWeek: 20 });
  check('10배 어긋나면 판정 보류 + 되묻기', scaled.judgments[0].status === 'indeterminate' && scaled.judgments[0].message.includes('37.9'), scaled.judgments[0].message);

  // (c) 생물학적으로 불가능한 값 (참고범위가 없어도 걸러야 한다)
  const impossible = evaluateRow({ rawName: '헤모글로빈', rawValue: '112', value: 112, unit: 'g/dL' } as any, { gestationalWeek: 20 }) as any;
  check('참고범위 없이도 불가능한 값은 보류', impossible.status === 'indeterminate', impossible.status);

  // (d) 단위를 못 읽으면 판정하지 않는다
  const noUnit = evaluateRow({ rawName: '헤모글로빈', rawValue: '11.2', value: 11.2, unit: '이상한단위' } as any, { gestationalWeek: 20 }) as any;
  check('모르는 단위 → 판정 보류', noUnit.status === 'indeterminate', noUnit.status);

  // (e) 정상 값은 방어막에 걸리지 않는다 (오탐 확인)
  const ok = evaluateRow({ rawName: '헤모글로빈', rawValue: '11.8', value: 11.8, unit: 'g/dL' } as any, { gestationalWeek: 20 }) as any;
  check('정상 값은 그대로 판정된다', ok.status === 'safe', ok.status);
}


console.log('\n=== 18. 같은 항목이 여러 번 읽히는 문제 (모델 반복 루프) ===');
{
  const hb = (v: string) => ({ rawName: '혈색소', rawValue: v, value: parseFloat(v), unit: 'g/dL' });

  // (a) 완전히 같은 줄이 반복 → 하나로 합친다
  const dup = evaluate([hb('8.4'), hb('8.4'), hb('8.4'), hb('8.4')] as any, { gestationalWeek: 30 });
  check('4번 반복 → 1개로 합쳐짐', dup.judgments.length === 1, dup.judgments.length);
  check('합쳐진 개수를 기록', dup.meta.removedDuplicates === 3, dup.meta.removedDuplicates);
  check('판정은 그대로 유지', dup.judgments[0].status === 'alert', dup.judgments[0].status);

  // (b) 같은 항목인데 값이 갈리면 판정하지 않는다
  const conflict = evaluate([hb('8.4'), hb('12.4')] as any, { gestationalWeek: 30 });
  check('값이 갈리면 1개로 합치되', conflict.judgments.length === 1, conflict.judgments.length);
  check('판정 보류', conflict.judgments[0].status === 'indeterminate', conflict.judgments[0].status);
  check('갈린 항목을 기록', (conflict.meta.conflictingDuplicates ?? []).length === 1, conflict.meta.conflictingDuplicates);

  // (c) 다른 항목은 합치지 않는다 (오탐 확인)
  const mixed = evaluate([hb('11.8'), { rawName: '혈소판수', rawValue: '223', value: 223, unit: '10^3/uL' }] as any, { gestationalWeek: 30 });
  check('서로 다른 항목은 그대로', mixed.judgments.length === 2, mixed.judgments.length);
  check('중복 제거 0건', mixed.meta.removedDuplicates === 0, mixed.meta.removedDuplicates);

  // (d) 위험값은 "오독 의심"을 이유로 경고를 지우지 않는다
  const plt = evaluate([{ rawName: '혈소판수', rawValue: '36.2', value: 36.2, unit: '10^3/uL' }] as any, { gestationalWeek: 30 });
  check('혈소판 36.2 → 경고는 그대로 alert', plt.judgments[0].status === 'alert', plt.judgments[0].status);
  check('동시에 "혹시 362?"를 묻는다', plt.judgments[0].caveats.some((c: string) => c.includes('362')), plt.judgments[0].caveats);

  // (e) 진짜 중증 빈혈은 오독으로 의심하지 않는다 (오탐 확인)
  const realLow = evaluate([hb('8.4')] as any, { gestationalWeek: 30 });
  check('Hb 8.4는 오독 의심 없이 alert', realLow.judgments[0].status === 'alert' && !realLow.judgments[0].caveats.some((c: string) => c.includes('혹시')), realLow.judgments[0].caveats);
}


console.log('\n=== 19. 긴 항목명 검사지 (참고범위 열이 없는 경우) ===');
{
  const mk = (n: string, v: string) => ({ rawName: n, rawValue: v, value: parseFloat(v), flag: 'N' });
  const rows = [
    mk('일반혈액검사(CBC)-[혈구세포-장비측정]_백혈구수', '8.40'),
    mk('일반혈액검사(CBC)-[혈구세포-장비측정]_혈색소[광전비색법]', '12.2'),
    mk('일반혈액검사(CBC)-[혈구세포-장비측정]_헤마토크리트', '36.2'),
    mk('일반혈액검사(CBC)-[혈구세포-장비측정]_혈소판수', '290'),
    mk('AST (SGOT) [화학반응-장비측정]', '19'),
    mk('MCV', '95.5'),
    mk('NEUT%', '73.4'),
  ];
  const res = evaluate(rows as any, { gestationalWeek: 30 });
  check('입력한 항목이 하나도 사라지지 않는다', res.judgments.length === rows.length, `${res.judgments.length}/${rows.length}`);

  const byName = (frag: string) => res.judgments.find((j) => j.itemName.includes(frag));
  check('긴 이름에서 백혈구를 알아본다', byName('백혈구')?.itemId === 'wbc', byName('백혈구')?.itemId);
  check('"혈색소[광전비색법]"도 알아본다', byName('헤모글로빈')?.itemId === 'hemoglobin', byName('헤모글로빈')?.itemId);
  check('"헤마토크리트"(t)도 알아본다', byName('헤마토크')?.itemId === 'hematocrit', byName('헤마토크')?.itemId);
  check('"AST (SGOT) [화학반응…]"도 알아본다', byName('AST')?.itemId === 'ast', byName('AST')?.itemId);

  // 값이 제자리에 붙었는지 (행 어긋남 회귀 방지)
  check('백혈구 = 8.4', byName('백혈구')?.value === 8.4, byName('백혈구')?.value);
  check('혈색소 = 12.2 (정상)', byName('헤모글로빈')?.value === 12.2 && byName('헤모글로빈')?.status === 'safe');
  check('혈소판 = 290 (정상)', byName('혈소판')?.value === 290 && byName('혈소판')?.status === 'safe');

  // 기준이 없는 항목도 표에 남되 판정은 하지 않는다
  const mcv = byName('MCV');
  check('MCV는 표에 남는다', !!mcv, res.judgments.map((j) => j.itemName));
  check('MCV는 판정하지 않는다', mcv?.status === 'info_only', mcv?.status);
  check('기준 없음 항목엔 출처를 붙이지 않는다', (mcv?.citations.length ?? 0) === 0);
}


console.log('\n=== 20. 같은 검사가 이름만 다르게 두 번 들어온 경우 ===');
{
  const mk = (n: string, v: string) => {
    const p = parseValueString(v);
    return { rawName: n, rawValue: v, ...p, flag: 'N' };
  };
  const res = evaluate(
    [mk('B형간염 표면항원(HBsAg)', 'positive'), mk('HBsAg', 'positive'), mk('풍진 항체(IgG)', '-')] as any,
    { gestationalWeek: 20 },
  );
  const hbs = res.judgments.filter((j) => j.itemId === 'hbsag');
  check('이름이 달라도 같은 검사면 한 줄로 합친다', hbs.length === 1, hbs.length);
  check('양성은 즉시 상담으로 판정된다 (보류 아님)', hbs[0]?.status === 'alert', hbs[0]?.status);
  check('판정 근거가 붙는다', (hbs[0]?.citations.length ?? 0) > 0);

  // 값이 갈리면 합치되 판정을 거둔다
  const conflict = evaluate([mk('B형간염 표면항원(HBsAg)', 'positive'), mk('HBsAg', 'negative')] as any, { gestationalWeek: 20 });
  const c = conflict.judgments.filter((j) => j.itemId === 'hbsag');
  check('값이 갈리면 한 줄 + 판정 보류', c.length === 1 && c[0].status === 'indeterminate', c[0]?.status);
  check('보류일 땐 출처를 붙이지 않는다', c[0]?.citations.length === 0);

  // 결과가 없는 항목은 "결과 없음"으로 라벨링된다
  const empty = res.judgments.find((j) => j.itemId === 'rubella_igg');
  check("'-' 항목은 '결과 없음' 라벨", empty?.label === '결과 없음', empty?.label);

  // 판정이 원본 행과 정확히 짝지어진다
  check('판정마다 원본 행 좌표가 실린다', res.judgments.every((j) => j.sourceIndex !== undefined));
}

console.log(`\n----------------------------------------\n최종 ${pass + fail}건 중 PASS ${pass} / FAIL ${fail}\n`);
