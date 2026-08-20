import type { ParsedTestItem } from "@/lib/report";
import { analyzeRows, type AnalyzeResult } from "@/lib/labs/bridge";
import type { ExtractedRow } from "@/lib/labs/types";
import { parsePrintedRange } from "@/lib/labs/normalize";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
/**
 * 검사지 사진을 읽는 모델.
 *
 * 실제 검사지(GC Labs 25행)로 재본 결과 gpt-4o-mini는 22개 항목 중 12개만 맞고
 * 값을 지어내기까지 했다(WBC 8.37을 6.2로, Platelet 301을 199로). 같은 프롬프트로
 * gpt-4o는 19개가 맞고 누락이 없었다. 수치를 잘못 읽으면 그대로 판정까지 틀어지는
 * 화면이라 정확도를 택했다. 비용은 검사지 한 장당 약 $0.02 수준.
 *
 * 요약 생성(lib/insights.ts)은 이미지가 없는 텍스트 작업이라 mini를 그대로 쓴다.
 */
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OCR_MODEL || "gpt-4o";

// ─────────────────────────────────────────────────────────────────────────────
// 이 파일은 더 이상 "판정"을 하지 않는다.
//
// 예전 프롬프트는 모델에게 "status(안심/주의/위험)를 정해 ... 임신부 정상
// 참고범위에 대한 너의 의학 지식으로 판단하고"라고 시켰다. 그 구조에서는
//   (1) 왜 그렇게 판정했는지 근거를 추적할 수 없고,
//   (2) 가이드라인이 개정돼도(ATA는 2026년 6월에 개정됐다) 반영할 방법이 없고,
//   (3) 검사실마다 다른 참고범위를 무시하게 되고,
//   (4) B형간염 표면'항체' 음성을 '위험'으로 띄우는 것 같은 오판정을 막을 수 없다.
//
// 그래서 역할을 둘로 쪼갰다.
//   이 파일        : 검사지에 적힌 것을 그대로 옮겨 적기만 한다(전사).
//   lib/labs/*    : 학회 기준표를 lookup해서 결정론적으로 판정하고 출처를 붙인다.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  "너는 한국 병원의 산전 검사 결과지 사진에서 데이터를 그대로 옮겨 적는 전사자야.\n\n" +
  "## 절대 규칙\n" +
  "1. 너는 판정하지 않는다. 정상/비정상, 안심/주의/위험, 높음/낮음을 스스로 판단하지 마.\n" +
  "2. 의학적 해석·조언·설명을 쓰지 마.\n" +
  "3. 검사지에 적혀 있는 것만 옮겨. 안 보이는 값은 추측하지 말고 null로 둬.\n" +
  "4. 검사지에 참고범위(정상범위, 참고치)가 인쇄돼 있으면 반드시 함께 옮겨. 이게 가장 중요하다.\n" +
  "5. 표에 보이는 행은 하나도 빠짐없이 전부 담아. 낯선 항목도 건너뛰지 마.\n" +
  "6. 구분선이나 소제목(예: 'AIDS', '혈액검사')처럼 결과값이 없는 줄은 항목으로 만들지 마.\n\n" +
  "## 표 읽는 법 (여기서 실수가 가장 많이 난다)\n" +
  "**가장 중요한 규칙: 표는 반드시 가로 한 줄씩 읽어. 검사항목 열을 먼저 쭉 읽고 결과 열을 " +
  "따로 읽어서 순서대로 짝지으면 절대 안 돼.** 한 항목의 rawName과 rawValue는 사진에서 같은 " +
  "높이(같은 가로줄)에 있는 글자여야 해. 각 행을 담기 전에 그 값이 정말 그 항목과 같은 줄에 " +
  "있는지 눈으로 한 번 더 확인해.\n" +
  "표에는 다음이 섞여 있으니 주의해:\n" +
  "(1) 검사항목 칸에 이름만 있고 결과 칸이 비어 있는 '그룹 제목' 행이 있다(예: 'Urine Routine', '말기검사'). " +
  "실제 결과가 아니므로 rows에 넣지 말고, 아래 행들의 값이 위로 당겨지지 않게 조심해.\n" +
  "(2) 한 항목의 결과가 여러 줄에 걸쳐 적힌 행이 있다(예: '요침사'의 'WBC: 0-3', 'RBC: 4-9'). " +
  "이건 여러 개가 아니라 한 항목이니 ', '로 이어 붙여 하나의 rawValue로 담아.\n" +
  "(3) 보험코드가 붙은 행과 안 붙은 행이 섞여 있는데, 코드 유무는 항목 구분과 관계없다.\n" +
  "(4) 결과값이 항목명보다 살짝 위아래로 치우쳐 인쇄된 경우가 있으니, 가장 가까운 같은 줄을 기준으로 삼아.\n\n" +
  "## 열 구분\n" +
  "**표는 보통 왼쪽부터 [보험코드] [검사항목] [검사결과] [단위] [참고치] 순서다.**\n" +
  "- rawValue에는 반드시 '검사결과' 열의 값만 담아.\n" +
  "- '참고치'(정상범위) 열은 '6 ~ 20', '11.0 ~ 15.0'처럼 두 숫자를 이은 범위이거나 'Negative' 같은 " +
  "기준값이야. 이건 rawValue가 아니라 **printedRangeRaw에 따로** 담아. 결과 열은 보통 범위가 아니라 단일 값이야.\n" +
  "- 어떤 항목의 결과 칸이 비어 보이면 참고치 열에서 값을 끌어오지 말고 그 항목을 빼.\n" +
  "- '정상'·'이상' 같은 판정 열의 글자를 rawValue로 쓰지 마. 그건 flag로 처리한다.\n" +
  "- 판정 열에 '△/이상·상한', '▽/이상·하한', H, L 같은 표시가 있으면 flag를 각각 \"H\", \"L\"로 넣어.\n" +
  "- 검사항목 이름이 '일반혈액검사(CBC)-[혈구세포-장비측정]_백혈구수'처럼 길면 **줄여 쓰지 말고 그대로** 옮겨.\n\n" +
  "## 숫자를 지어내지 마\n" +
  "**흐릿해서 확실하지 않으면 그 항목을 rows에서 빼고 unreadable에 남기는 편이 잘못된 숫자를 적는 것보다 낫다.** " +
  "읽어낸 숫자는 사진에 인쇄된 자릿수 그대로 옮겨(예: 8.37을 8.4나 9.3으로 바꾸지 마).\n\n" +
  "## 항목마다 뽑을 것\n" +
  "- rawName: 검사지에 적힌 항목명 그대로 (번역·풀어쓰기 금지)\n" +
  "- rawValue: 결과값 문자열 그대로 (예: \"11.2\", \"음성\", \"음성(4.80)\", \"NR\", \"2+\")\n" +
  "- unit: 단위 그대로 (예: \"g/dL\", \"10^3/uL\", \"mIU/L\"). 없으면 null\n" +
  "- printedRangeRaw: 인쇄된 참고범위 문자열 그대로 (예: \"12.0-16.0\", \"<5.0\"). 없으면 null\n" +
  "- flag: 검사실이 붙인 이상 표시가 있으면 \"H\" 또는 \"L\", 없으면 \"N\"\n\n" +
  "## 문서 전체\n" +
  "- reportDate: 검사일/채취일/접수일/발급일자 중 하나를 YYYY-MM-DD로. 없으면 null (지어내지 마)\n" +
  "- labName: 검사기관·병원 이름. 없으면 null\n\n" +
  '출력은 JSON 객체 하나로만: {"labName": string|null, "reportDate": string|null, ' +
  '"rows": [{"rawName": string, "rawValue": string, "unit": string|null, ' +
  '"printedRangeRaw": string|null, "flag": "H"|"L"|"N"}], ' +
  '"unreadable": [{"reason": string, "location": string}]}\n' +
  "읽기 어렵거나 확신이 없으면 rows에 억지로 넣지 말고 unreadable에 남겨. " +
  "잘못 읽는 것보다 못 읽었다고 말하는 게 낫다.";

type OcrRow = {
  rawName: string;
  rawValue: string;
  unit: string | null;
  printedRangeRaw: string | null;
  flag: "H" | "L" | "N";
};

async function uriToDataUrl(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("이미지를 읽지 못했어요."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export type ParsedTestReport = {
  items: ParsedTestItem[];
  /** 문서에 인쇄된 검사일("YYYY-MM-DD"). 못 찾으면 null. */
  reportDate: string | null;
  /** 여러 항목을 함께 봐야 나오는 소견 */
  crossFindings: AnalyzeResult["crossFindings"];
  /** 아직 지원하지 않는 항목 — 화면에 밝혀서 보여준다 */
  unsupported: AnalyzeResult["unsupported"];
  /** 화면 하단 출처 표기 */
  sources: AnalyzeResult["sources"];
  dataUpdatedAt: string;
  /** 모델이 "못 읽겠다"고 스스로 남긴 부분 */
  unreadable: { reason: string; location: string }[];
  /** 두 번 읽었을 때 값이 갈린 항목 */
  conflicts: { name: string; a: string; b: string }[];
};

export type ParseContext = {
  /** 임신 주수 — 삼분기별 기준을 가르는 핵심 입력. 없으면 주수 무관 기준만 적용된다. */
  gestationalWeek?: number;
  /** 'high_risk' | 'gdm_diagnosed' 등 */
  flags?: string[];
  previousResults?: { itemId: string; value: number; testedAt: string }[];
};

/** 결과값이 숫자로 시작하는 경우에만 수치로 본다. "음성(4.80)" 같은 건 정성값 + 참고수치. */
function toRow(r: OcrRow): ExtractedRow {
  const raw = (r.rawValue ?? "").trim();
  const leadingNumber = raw.match(/^-?\d+(?:\.\d+)?/);
  const parenNumber = raw.match(/\((-?\d+(?:\.\d+)?)\)/);
  const value = leadingNumber
    ? parseFloat(leadingNumber[0])
    : parenNumber
      ? parseFloat(parenNumber[1])
      : undefined;

  return {
    rawName: r.rawName,
    rawValue: raw,
    value: Number.isFinite(value as number) ? (value as number) : undefined,
    unit: r.unit ?? undefined,
    printedRange: r.printedRangeRaw ? parsePrintedRange(r.printedRangeRaw) : undefined,
    flag: r.flag ?? "N",
  };
}

/**
 * 검사지 사진 → 구조화된 값 추출(LLM) → 학회 기준 lookup 판정(결정론적).
 * 판정·문구·출처는 전부 lib/labs가 만든 것이고, LLM은 글자를 옮기기만 한다.
 */
export async function parseTestReport(
  imageUri: string,
  ctx: ParseContext = {},
): Promise<ParsedTestReport> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OpenAI API 키가 설정되지 않았어요. .env 파일에 EXPO_PUBLIC_OPENAI_API_KEY를 추가하고 개발 서버를 재시작해주세요.",
    );
  }

  const dataUrl = await uriToDataUrl(imageUri);
  const first = await extractOnce(dataUrl);

  // 1차 추출 결과를 판정해 보고, 의심스러운 항목이 하나라도 있으면 2차 추출로 대조한다.
  // 매번 두 번 부르면 비용·시간이 두 배라, "수상할 때만" 한 번 더 본다.
  const firstRows = toRows(first);
  const firstPass = analyzeRows(firstRows, engineCtx(ctx));
  const suspect = firstPass.items.some((i) => i.engineStatus === "indeterminate");

  let rows = firstRows;
  let conflicts: { name: string; a: string; b: string }[] = [];

  if (suspect) {
    try {
      const second = await extractOnce(dataUrl);
      const merged = crossCheck(first, second);
      conflicts = merged.conflicts;
      rows = toRows(merged.agreed);
      // 두 번 읽어서 값이 갈린 항목은 "확실치 않음"으로 표시해 사용자에게 확인받는다.
      for (const c of conflicts) {
        const row = rows.find((r) => r.rawName === c.name);
        if (row) row.uncertain = `두 번 읽었을 때 값이 달랐어요 (${c.a} / ${c.b}).`;
      }
    } catch {
      // 2차 추출이 실패해도 1차 결과로 계속 진행한다.
    }
  }

  const analyzed = analyzeRows(rows, engineCtx(ctx));

  const rawDate = (first as { reportDate?: unknown })?.reportDate;
  const reportDate =
    typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim()) ? rawDate.trim() : null;

  return {
    items: analyzed.items,
    reportDate,
    crossFindings: analyzed.crossFindings,
    unsupported: analyzed.unsupported,
    sources: analyzed.sources,
    dataUpdatedAt: analyzed.dataUpdatedAt,
    unreadable: Array.isArray((first as any)?.unreadable) ? (first as any).unreadable : [],
    conflicts,
  };
}

function engineCtx(ctx: ParseContext) {
  return {
    gestationalWeek: ctx.gestationalWeek,
    flags: ctx.flags,
    previousResults: ctx.previousResults,
  };
}

/** OCR 원본 응답 → 판정 엔진 입력 */
function toRows(raw: unknown): ExtractedRow[] {
  const rawRows = Array.isArray((raw as { rows?: unknown })?.rows)
    ? ((raw as { rows: unknown[] }).rows as OcrRow[])
    : [];
  return rawRows
    .filter((r) => !!r && typeof r === "object" && typeof r.rawName === "string" && r.rawName.trim())
    // 산전 검사지는 아무리 길어도 60행을 넘지 않는다. 그 이상이면 모델이 폭주한 것이라
    // 잘라낸다(중복은 뒤에서 dedupeRows가 한 번 더 걸러준다).
    .slice(0, 60)
    .map((r) => toRow({ ...r, rawName: String(r.rawName).trim(), rawValue: String(r.rawValue ?? "").trim() }));
}

/**
 * 같은 사진을 두 번 읽어 값이 갈리는 항목을 찾아낸다.
 * 온도를 0으로 두어도 비전 모델은 흐린 숫자에서 답이 갈릴 수 있는데,
 * 그 "갈리는 지점"이 곧 잘못 읽었을 가능성이 높은 지점이다.
 */
function crossCheck(a: any, b: any): { agreed: any; conflicts: { name: string; a: string; b: string }[] } {
  const rowsA: OcrRow[] = Array.isArray(a?.rows) ? a.rows : [];
  const rowsB: OcrRow[] = Array.isArray(b?.rows) ? b.rows : [];
  const mapB = new Map(rowsB.map((r) => [String(r.rawName ?? "").trim().toLowerCase(), r]));
  const conflicts: { name: string; a: string; b: string }[] = [];

  for (const r of rowsA) {
    const key = String(r.rawName ?? "").trim().toLowerCase();
    const other = mapB.get(key);
    if (!other) continue; // 한쪽에만 있는 행은 여기서 판단하지 않는다(항목 자체를 버리지 않기 위해)
    const va = String(r.rawValue ?? "").trim();
    const vb = String(other.rawValue ?? "").trim();
    if (va !== vb) conflicts.push({ name: String(r.rawName).trim(), a: va, b: vb });
  }
  return { agreed: a, conflicts };
}

async function extractOnce(dataUrl: string): Promise<unknown> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      // 판정 문장을 생성하지 않으므로 예전보다 응답이 짧다. 대신 온도를 0으로 두어
      // 같은 사진이면 같은 값이 나오게 한다(전사 작업이라 창의성이 필요 없다).
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "이 산전 검사지 사진을 읽고 지시한 JSON 형식으로 옮겨 적어줘. 판정은 하지 마." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      // frequency_penalty는 쓰지 않는다.
      // 한국 검사지는 항목명이 "일반혈액검사(CBC)-[혈구세포-장비측정]_백혈구수"처럼
      // 긴 공통 접두사를 공유하는데, 반복 패널티를 걸면 그 접두사 토큰이 억제되면서
      // 모델이 뒷 행을 아예 생성하지 않고 멈춘다(17행 중 3행만 나오던 원인).
      // 반복 문제는 프롬프트 규칙 + dedupeRows(코드)로 막는다.
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenAI 요청 실패 (${response.status}): ${errText.slice(0, 300)}`);
  }

  const json = await response.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI 응답에서 결과를 찾지 못했어요.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI 응답을 JSON으로 해석하지 못했어요.");
  }

  return parsed;
}
