import { normalizeFoodName, RECOMMENDABLE_FOODS } from "@/lib/foods";
import type { ParsedTestItem } from "@/lib/report";

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || "gpt-4o-mini";

// 판정은 이미 lib/labs(학회 기준표 lookup)가 끝냈다. 이 프롬프트는 "이미 정해진
// 판정과 문구 안에서" 요약·질문·음식만 쓰게 제한한다. 모델이 판정을 바꾸거나
// 없는 항목을 지어내지 못하도록 규칙을 앞에 못 박아 둔다.
const SYSTEM_PROMPT =
  "너는 이미 판정이 끝난 임산부의 산전 검사 결과를 보고 세 가지를 작성하는 도우미야.\n\n" +
  "## 절대 규칙\n" +
  "1. 각 항목의 상태(판정)는 이미 확정됐다. 절대 바꾸거나 다시 판단하지 마.\n" +
  "2. 입력에 없는 수치·항목·의학 지식을 추가하지 마. 준 항목만 근거로 삼아.\n" +
  "3. **결과값이 없는 항목(\'결과 없음\', \'-\')에 대해서는 아무 말도 하지 마.** " +
  "특히 그런 항목으로 질문을 만들지 마 — 값이 없는데 \'이 상태를 유지하려면\' 같은 " +
  "질문을 만들면 사용자를 혼란스럽게 한다.\n" +
  "4. 상태가 \'재검 필요\'나 \'판정 보류\'인 항목은 확정적으로 말하지 마. " +
  "\'재검으로 확인이 필요하다\'는 톤을 유지해.\n" +
  "5. 상태가 \'참고\'인 항목(임신 중 자연스럽게 변하는 값)은 문제처럼 쓰지 마.\n" +
  "5-1. **주어지지 않은 상태 표현을 만들어 내지 마.** 상태가 \'확인 필요\'인데 " +
  "\'위험한데\'라고 쓰면 안 된다. 각 항목의 상태 라벨을 그대로 쓰거나, 라벨과 같은 " +
  "강도의 표현만 써라.\n" +
  "5-2. 상태가 \'확인 필요\'·\'판정 보류\'인 항목은 **수치를 근거로 질문을 만들지 마.** " +
  "그 수치는 잘못 읽혔을 수 있어서 아직 확정되지 않았다. 굳이 다룬다면 " +
  "\'이 항목은 숫자가 확실하지 않아 확인이 필요하다\' 정도로만 언급해라.\n" +
  "6. 진단·처방하지 말고 참고 정보 톤을 유지해.\n" +
  "7. **임신 주차가 주어지면 그 주차에 맞춰 써.** 같은 수치라도 주차에 따라 의미가 " +
  "다르다 — 예: 헤모글로빈 기준은 1분기 11.0 / 2분기 10.5 / 3분기 11.0이고, 2분기에는 " +
  "혈액량이 늘어 수치가 낮아지는 게 자연스럽다. 임신성 당뇨 선별은 24~28주, 빈혈 재검도 " +
  "24~28주에 한다. 지금 주차에서 곧 받게 될 검사나 챙길 것이 있으면 자연스럽게 언급해. " +
  "다만 **주차 때문에 판정을 바꾸지는 마** — 판정은 이미 주차를 반영해서 확정됐다.\n" +
  "8. 주차가 '알 수 없음'으로 주어지면 주차 이야기를 아예 꺼내지 말고, 대신 마지막에 " +
  "'임신 주차를 입력하면 주차에 맞는 기준으로 더 정확히 볼 수 있어요' 한 문장을 덧붙여.\n\n" +
  "## 작성할 것\n" +
  "1) summary: 이번 결과 전체를 3~5문장으로 요약. 첫 문장은 지금 임신 주차를 언급하며 시작해 "
  "(예: \"임신 28주차에 받은 이번 검사는…\"). 신경 쓸 항목이 있으면 항목명·수치와 " +
  "함께 왜 그런지 짚어주고, 전부 안심이면 안정적이라는 점을 강조해. 검사지 기준과 임신 " +
  "중 기준이 다른 항목이 있으면(입력의 \'대조\' 줄) 그 점을 꼭 알려줘 — 사용자가 검사지의 " +
  "빨간 표시를 보고 불안해하던 부분이라 가장 도움이 되는 정보다.\n" +
  "2) questions: 다음 진료 때 물어볼 질문 2~4개. 입력에 \'추천질문\'이 적힌 항목이 있으면 " +
  "그 문장을 우선 사용하고, 부족하면 상태가 안심이 아닌 항목을 근거로 추가해. " +
  "결과값이 없는 항목으로는 만들지 마.\n" +
  "3) foods: 신경 쓸 항목을 보완하는 데 도움이 될 음식 3~6개. 각 음식은 name과 " +
  "reason(왜 도움되는지 1문장). 전부 안심이면 임신 중 전반적으로 도움되는 음식으로 대체해도 돼.\n" +
  "**name은 반드시 아래 재료 목록 안에서만 고르고, 목록에 적힌 이름 그대로(괄호·수식어 없이) 써. " +
  "목록에 없는 재료는 절대 추천하지 말고, 같은 재료를 두 번 넣지 마.**\n" +
  `사용 가능한 재료 목록: ${RECOMMENDABLE_FOODS.join(", ")}. ` +
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
      const status = item.badgeLabel || item.status;
      const lines = [`- ${item.name}: ${item.value || "정보 없음"} (${status})`];
      const note = item.verdict || item.definition || "";
      if (note) lines.push(`  설명: ${note}`);
      if (item.basisLabel) lines.push(`  판정기준: ${item.basisLabel}`);
      if (item.contrastNote) lines.push(`  대조: ${item.contrastNote}`);
      if (item.caveats?.length) lines.push(`  주의: ${item.caveats.join(" / ")}`);
      if (item.trendNote) lines.push(`  변화: ${item.trendNote}`);
      if (item.doctorQuestion) lines.push(`  추천질문: ${item.doctorQuestion}`);
      return lines.join("\n");
    })
    .join("\n");
}

// parseTestReport(lib/ocr.ts)가 읽어낸 검사항목 목록을 바탕으로, 사진을 다시
// 보내지 않고 텍스트만으로 종합 소견/추천 질문/추천 음식을 생성한다.
// analysis/report.tsx의 "종합 분석"(요약글), "질문 입력하기"(추천 질문),
// "추천 재료"(추천 음식) 칸을 채우는 데 쓰인다.
export type InsightContext = {
  /** 임신 주차. 판정은 이미 주차를 반영했고, 이 값은 설명 문장을 주차에 맞추는 데 쓴다. */
  gestationalWeek?: number;
  /** 'high_risk' | 'gdm_diagnosed' 등 사용자 상황 */
  flags?: string[];
};

/** 주차 → 분기 + 그 시기에 흔히 하는 산전 검사. 프롬프트에 맥락으로 넣는다. */
function weekContext(week?: number): string {
  if (week === undefined || !Number.isFinite(week) || week <= 0) {
    return "임신 주차: 알 수 없음 (사용자가 아직 입력하지 않음)";
  }
  const trimester = week <= 13 ? "1분기(초기)" : week <= 27 ? "2분기(중기)" : "3분기(후기)";
  const schedule =
    week <= 13
      ? "이 시기에는 초기 기본 혈액·소변검사, 혈액형, 감염 선별(B형간염·매독·HIV·풍진)을 한다."
      : week <= 23
        ? "이 시기에는 기형아 선별검사와 정밀초음파를 하고, 다음으로 24~28주에 임신성 당뇨 선별과 빈혈 재검이 예정돼 있다."
        : week <= 28
          ? "이 시기에는 임신성 당뇨 선별(50g 당부하)과 빈혈 재검(CBC)을 한다."
          : "이 시기에는 분만 준비 검사와 함께 빈혈·혈압·단백뇨를 지켜본다.";
  return `임신 주차: ${week}주차 (${trimester})\n이 주차의 산전검사 맥락: ${schedule}`;
}

export async function generateReportInsights(
  items: ParsedTestItem[],
  ctx: InsightContext = {},
): Promise<ReportInsights> {
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
          content:
            `## 사용자 정보\n${weekContext(ctx.gestationalWeek)}` +
            (ctx.flags?.length ? `\n상황: ${ctx.flags.join(", ")}` : "") +
            `\n\n## 이번 산전 검사 결과 (판정은 이미 확정됨)\n${itemsToText(items)}\n\n` +
            `위 내용을 바탕으로 지시한 JSON 형식으로 작성해줘. 판정은 바꾸지 말고, 임신 주차에 맞춰 설명해줘.`,
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

  // 재료는 이미지가 준비된 30가지(lib/foods.ts)만 노출한다. 모델이 목록 밖 재료를
  // 내놓거나 이름에 수식어를 붙이면 여기서 정규화하고, 못 맞추면 버린다.
  const rawFoods = (parsed as { foods?: unknown })?.foods;
  const seenFoods = new Set<string>();
  const foods = Array.isArray(rawFoods)
    ? rawFoods
        .filter(
          (food): food is { name: string; reason?: unknown } =>
            !!food && typeof food === "object" && typeof (food as any).name === "string" && (food as any).name.trim(),
        )
        .map((food) => ({
          name: normalizeFoodName(String(food.name)),
          reason: food.reason != null ? String(food.reason).trim() : "",
        }))
        .filter((food) => {
          if (!food.name || seenFoods.has(food.name)) return false;
          seenFoods.add(food.name);
          return true;
        })
        .map((food): ReportFood => ({ name: food.name as string, reason: food.reason }))
    : [];

  if (!summary) throw new Error("OpenAI 응답에서 종합 소견을 찾지 못했어요.");

  return { summary, questions, foods };
}
