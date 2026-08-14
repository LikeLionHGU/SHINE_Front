import type { IndicatorStatus, ParsedTestItem } from "@/lib/report";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT =
  "너는 임산부의 산전 검사지(혈액검사·소변검사 등) 사진을 읽고 표로 정리해주는 의료 문서 도우미야. " +
  "사진 속 표에서 검사 항목명과 그 결과 수치(참고치가 같이 적혀 있으면 함께 옮겨 적어)를 읽어내고, " +
  "그 수치가 일반적인 임신부 정상 참고범위에 비춰 안심/주의/위험 중 무엇에 해당하는지 " +
  "너의 의학 지식으로 판단해줘. 확신이 서지 않으면 '주의'로 표기해. " +
  '출력은 반드시 JSON 객체 하나로만: {"items": [{"name": string, "value": string, "status": "안심" | "주의" | "위험"}]}. ' +
  "표에서 읽을 수 있는 항목은 전부 items 배열에 담아줘. 사진이 검사지가 아니거나 아무 것도 읽을 수 없으면 items를 빈 배열로 줘.";

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

// 검사지 사진에서 "검사항목 / 수치 / 상태"를 실제로 읽어내는 OCR + 판정.
// 백엔드 서버가 없어서 클라이언트에서 바로 OpenAI Vision(gpt-4o-mini)에
// 이미지를 보내고, 표 인식과 정상범위 판정을 모델에게 맡긴 뒤 구조화된
// JSON으로 돌려받는다. (주의: API 키가 클라이언트 번들에 포함되므로
// 해커톤 데모용 구조다 — 프로덕션에서는 서버를 거쳐야 한다.)
export async function parseTestReport(imageUri: string): Promise<ParsedTestItem[]> {
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
            { type: "text", text: "이 산전 검사지 사진을 읽고 지시한 JSON 형식으로 정리해줘." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 2000,
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

  const rawItems = Array.isArray((parsed as { items?: unknown })?.items)
    ? (parsed as { items: unknown[] }).items
    : [];
  const validStatuses: IndicatorStatus[] = ["안심", "주의", "위험"];

  return rawItems
    .filter(
      (item): item is { name: string; value?: unknown; status?: unknown } =>
        !!item && typeof item === "object" && typeof (item as any).name === "string" && (item as any).name.trim(),
    )
    .map(
      (item): ParsedTestItem => ({
        name: String(item.name).trim(),
        value: item.value != null ? String(item.value).trim() : "",
        status: validStatuses.includes(item.status as IndicatorStatus) ? (item.status as IndicatorStatus) : "주의",
      }),
    );
}
