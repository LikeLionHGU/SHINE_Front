import type { IndicatorStatus, ParsedTestItem } from "@/lib/report";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT =
  "너는 임산부의 산전 검사지(혈액검사·소변검사 등) 사진을 읽고 표로 정리해주는 의료 문서 도우미야. " +
  "사진 속 표에 보이는 행은 하나도 빠짐없이 전부 읽어야 해 — 네가 잘 아는 항목이든 낯선 항목이든, " +
  "수치형(예: 12.2 g/dL)이든 정성형(예: 음성, 정상, RH+, A형)이든 상관없이 표에 있는 행은 전부 " +
  "items 배열에 담아. 일부만 골라 담거나 어려운 항목을 건너뛰면 안 돼. " +
  "각 항목마다 name(검사명)과 value(결과값 — 참고치가 같이 적혀 있으면 원문 그대로 옮겨 적어)를 읽어내고, " +
  "status(안심/주의/위험)를 정해. 검사지에 이미 '판정' 또는 '결과' 같은 컬럼에 정상/이상 등 판정이 " +
  "인쇄되어 있으면, 그 인쇄된 판정을 최우선 근거로 삼아 정상→안심, 이상→위험, 경계/애매함→주의로 " +
  "매핑해(네가 다시 계산하지 마). 인쇄된 판정이 없는 항목만 임신부 정상 참고범위에 대한 너의 의학 " +
  "지식으로 판단하고, 확신이 서지 않으면 '주의'로 표기해. " +
  "각 항목마다 두 문장도 간결하게 채워줘: definition은 '이 검사 항목이 일반적으로 무엇을 보는 지표인지'를 " +
  "임산부가 이해하기 쉬운 말로 1문장 설명한 것(이번 수치와 무관한 일반 설명), verdict는 '이번에 읽은 " +
  "수치가 왜 그 상태로 판정됐는지'를 이번 수치·참고범위(또는 인쇄된 판정)를 근거로 1문장으로 설명한 " +
  "것이야. 두 문장 모두 진단·처방처럼 단정하지 말고 참고 정보 톤으로. " +
  "마지막으로 reportDate도 찾아줘 — 문서에 '검사일', '채취일', '접수일', '발급일자' 등으로 인쇄된, " +
  "이 검사를 받은 날짜를 YYYY-MM-DD 형식으로 알려줘. 여러 날짜가 있으면 검사/채취일을 우선하고, " +
  "발급일자만 있으면 그거라도 써. 날짜를 전혀 찾을 수 없으면 reportDate는 null로 줘(추측해서 " +
  "지어내지 마). " +
  '출력은 반드시 JSON 객체 하나로만: {"items": [{"name": string, "value": string, "status": "안심" | "주의" | "위험", "definition": string, "verdict": string}], "reportDate": string | null}. ' +
  "사진이 검사지가 아니거나 표를 전혀 읽을 수 없으면 items를 빈 배열로, reportDate를 null로 줘.";

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
};

// 검사지 사진에서 "검사항목 / 수치 / 상태 / 검사일"을 실제로 읽어내는 OCR + 판정.
// 백엔드 서버가 없어서 클라이언트에서 바로 OpenAI Vision(gpt-4o-mini)에
// 이미지를 보내고, 표 인식과 정상범위 판정을 모델에게 맡긴 뒤 구조화된
// JSON으로 돌려받는다. (주의: API 키가 클라이언트 번들에 포함되므로
// 해커톤 데모용 구조다 — 프로덕션에서는 서버를 거쳐야 한다.)
export async function parseTestReport(
  imageUri: string,
): Promise<ParsedTestReport> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OpenAI API 키가 설정되지 않았어요. .env 파일에 EXPO_PUBLIC_OPENAI_API_KEY를 추가하고 개발 서버를 재시작해주세요.",
    );
  }

  const dataUrl = await uriToDataUrl(imageUri);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "이 산전 검사지 사진을 읽고 지시한 JSON 형식으로 정리해줘.",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      // 산전 검사지는 보통 15~20행 이상이라 항목마다 definition/verdict까지
      // 채우면 응답이 길어진다. 예전 2000 토큰 한도에서는 응답이 중간에 잘려
      // 뒷부분 항목이 통째로 빠지는 문제가 있어 넉넉하게 올림.
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `OpenAI 요청 실패 (${response.status}): ${errText.slice(0, 300)}`,
    );
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

  const rawItems = Array.isArray((parsed as { items?: unknown })?.items)
    ? (parsed as { items: unknown[] }).items
    : [];
  const validStatuses: IndicatorStatus[] = ["안심", "주의", "위험"];

  const items = rawItems
    .filter(
      (
        item,
      ): item is {
        name: string;
        value?: unknown;
        status?: unknown;
        definition?: unknown;
        verdict?: unknown;
      } =>
        !!item &&
        typeof item === "object" &&
        typeof (item as any).name === "string" &&
        (item as any).name.trim(),
    )
    .map(
      (item): ParsedTestItem => ({
        name: String(item.name).trim(),
        value: item.value != null ? String(item.value).trim() : "",
        status: validStatuses.includes(item.status as IndicatorStatus)
          ? (item.status as IndicatorStatus)
          : "주의",
        definition:
          item.definition != null ? String(item.definition).trim() : "",
        verdict: item.verdict != null ? String(item.verdict).trim() : "",
      }),
    );

  // reportDate는 "YYYY-MM-DD" 형식일 때만 신뢰한다 — 형식이 다르거나
  // 모델이 엉뚱한 값을 주면 null로 취급해서(파싱 실패와 동일하게) 화면에서
  // 사용자가 직접 날짜를 고르게 한다.
  const rawDate = (parsed as { reportDate?: unknown })?.reportDate;
  const reportDate =
    typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())
      ? rawDate.trim()
      : null;

  return { items, reportDate };
}
