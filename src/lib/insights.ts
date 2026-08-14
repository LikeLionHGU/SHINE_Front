import type { ParsedTestItem } from "@/lib/report";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT =
  "너는 임산부의 산전 검사 결과 목록(항목명, 수치, 상태(안심/주의/위험), 설명)을 보고 세 가지를 " +
  "작성하는 도우미야. 절대 진단하거나 처방하지 말고 참고 정보 톤을 유지해. 입력에 없는 수치나 " +
  "항목을 지어내지 말고, 반드시 준 항목만 근거로 삼아. " +
  "1) summary: 이번 검사 결과 전체를 3~5문장으로 요약한 종합 소견. 주의/위험 항목이 있으면 어떤 " +
  "부분을 왜 신경 써야 하는지 구체적으로(항목명·수치 언급) 짚어주고, 전부 안심이면 안정적이라는 " +
  "점을 강조해. " +
  "2) questions: 다음 진료 때 의사에게 물어보면 좋을 질문 2~4개. 주의/위험 상태인 항목을 근거로 " +
  "구체적으로 작성해(예: '요단백 수치가 1.4로 나왔는데 관리가 필요한가요?'). 전부 안심이면 일반적인 " +
  "임신 관리 관련 질문으로 대체해도 돼. " +
  "3) foods: 주의/위험 항목을 보완하거나 관련 영양소를 채우는 데 도움이 될 음식 3~6개. 각 음식은 " +
  "name(한두 단어, 예: '시금치')과 reason(왜 도움되는지 1문장)으로. 전부 안심이면 임신 중 전반적으로 " +
  "도움이 되는 음식으로 대체해도 돼. " +
  '출력은 반드시 JSON 객체 하나로만: {"summary": string, "questions": string[], "foods": [{"name": string, "reason": string}]}.';

export type ReportFood = { name: string; reason: string };

export type ReportInsights = {
  summary: string;
  questions: string[];
  foods: ReportFood[];
};

function itemsToText(items: ParsedTestItem[]) {
  return items
    .map((item) => {
      const note = item.verdict || item.definition || "";
      return `- ${item.name}: ${item.value || "정보 없음"} (${item.status})${note ? ` — ${note}` : ""}`;
    })
    .join("\n");
}

// parseTestReport(lib/ocr.ts)가 읽어낸 검사항목 목록을 바탕으로, 사진을 다시
// 보내지 않고 텍스트만으로 종합 소견/추천 질문/추천 음식을 생성한다.
// analysis/report.tsx의 "종합 분석"(요약글), "질문 입력하기"(추천 질문),
// "추천 재료"(추천 음식) 칸을 채우는 데 쓰인다.
export async function generateReportInsights(items: ParsedTestItem[]): Promise<ReportInsights> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OpenAI API 키가 설정되지 않았어요. .env 파일에 EXPO_PUBLIC_OPENAI_API_KEY를 추가하고 개발 서버를 재시작해주세요.",
    );
  }
  if (!items || items.length === 0) {
    throw new Error("분석할 검사 항목이 없어요.");
  }

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
          content: `다음은 이번 산전 검사 결과야:\n${itemsToText(items)}\n\n위 내용을 바탕으로 지시한 JSON 형식으로 작성해줘.`,
        },
      ],
      max_tokens: 1000,
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

  const summary =
    typeof (parsed as { summary?: unknown })?.summary === "string"
      ? (parsed as { summary: string }).summary.trim()
      : "";

  const rawQuestions = (parsed as { questions?: unknown })?.questions;
  const questions = Array.isArray(rawQuestions)
    ? rawQuestions.filter((q): q is string => typeof q === "string" && q.trim().length > 0).map((q) => q.trim())
    : [];

  const rawFoods = (parsed as { foods?: unknown })?.foods;
  const foods = Array.isArray(rawFoods)
    ? rawFoods
        .filter(
          (food): food is { name: string; reason?: unknown } =>
            !!food && typeof food === "object" && typeof (food as any).name === "string" && (food as any).name.trim(),
        )
        .map(
          (food): ReportFood => ({
            name: String(food.name).trim(),
            reason: food.reason != null ? String(food.reason).trim() : "",
          }),
        )
    : [];

  if (!summary) throw new Error("OpenAI 응답에서 종합 소견을 찾지 못했어요.");

  return { summary, questions, foods };
}
