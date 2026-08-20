import type { IndicatorStatus, ParsedTestItem } from "@/lib/report";

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

const SYSTEM_PROMPT =
  "너는 임산부의 산전 검사지(혈액검사·소변검사 등) 사진을 읽고 표로 정리해주는 의료 문서 도우미야. " +
  "사진 속 표에 보이는 행은 하나도 빠짐없이 전부 읽어야 해 — 네가 잘 아는 항목이든 낯선 항목이든, " +
  "수치형(예: 12.2 g/dL)이든 정성형(예: 음성, 정상, RH+, A형)이든 상관없이 표에 있는 행은 전부 " +
  "items 배열에 담아. 일부만 골라 담거나 어려운 항목을 건너뛰면 안 돼. " +
  // 표를 열 단위로 읽어서 나중에 순서대로 짝지으면 항목과 수치가 어긋난다.
  // 실제 검사지(GC Labs 등)에는 결과가 비어 있는 그룹 라벨 행과, 결과가 여러
  // 줄인 행이 섞여 있어서 두 열의 줄 수가 애초에 맞지 않기 때문이다.
  "**가장 중요한 규칙: 표는 반드시 가로 한 줄씩 읽어. 검사항목 열을 먼저 쭉 읽고 검사결과 열을 " +
  "따로 읽어서 순서대로 짝지으면 절대 안 돼.** 한 항목의 name과 value는 사진에서 같은 높이(같은 " +
  "가로줄)에 있는 글자여야 해. 각 행을 담기 전에 그 값이 정말 그 항목과 같은 줄에 있는지 눈으로 " +
  "한 번 더 확인해. " +
  "표에는 다음이 섞여 있으니 주의해: " +
  "(1) 검사항목 칸에 이름만 있고 검사결과 칸이 비어 있는 '그룹 제목' 행이 있다(예: 'Urine Routine'). " +
  "이런 행은 실제 검사 결과가 아니므로 items에 넣지 말고, 아래 행들의 값이 위로 당겨지지 않게 조심해. " +
  "(2) 한 항목의 결과가 여러 줄에 걸쳐 적힌 행이 있다(예: '요침사(Flow cytometry)'의 'WBC: 0-3', " +
  "'RBC: 4-9', 'E.P cell: 0-3', 'Others: None'). 이건 네 개가 아니라 한 항목이니 여러 줄을 하나의 " +
  "value로 합쳐 담아(줄바꿈 대신 ', '로 이어 붙여). " +
  "(3) 보험코드가 붙은 행과 안 붙은 행이 섞여 있는데, 코드 유무는 항목 구분과 관계없다. " +
  "(4) 결과값이 항목명보다 살짝 아래나 위로 치우쳐 인쇄된 경우가 있으니, 가장 가까운 같은 줄을 기준으로 삼아. " +
  // 참고치 열에서 값을 집어오는 실수가 잦다. 열의 위치와 생김새를 함께 알려준다.
  "**열을 헷갈리지 마. 표는 보통 왼쪽부터 [보험코드] [검사항목] [검사결과] [단위] [참고치] 순서다.** " +
  "value에는 반드시 '검사결과' 열의 값만 담아. '참고치'(정상범위) 열은 '6 ~ 20', '0.50 ~ 0.90', " +
  "'11.0 ~ 15.0'처럼 물결표나 하이픈으로 두 숫자를 이은 범위이거나 'Negative'라고 적힌 기준값이야. " +
  "이 범위 값을 결과로 옮겨 적으면 완전히 틀린 수치가 된다. 결과 열은 보통 범위가 아니라 단일 값이야. " +
  "어떤 항목의 결과 칸이 비어 보이면 값을 참고치 열에서 끌어오지 말고 그 항목을 빼. " +
  // 값 지어내기는 의료 정보에서 가장 위험한 실패다.
  "**숫자는 절대 추측하거나 지어내지 마.** 흐릿해서 확실하지 않으면 그 항목을 items에서 빼는 편이 " +
  "잘못된 숫자를 적는 것보다 낫다. 읽어낸 숫자는 사진에 인쇄된 자릿수 그대로 옮겨(예: 8.37을 8.4나 " +
  "9.3으로 바꾸지 마). " +
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
