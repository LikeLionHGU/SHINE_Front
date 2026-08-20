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
  "5-2. 상태가 \'확인 필요\'·\'판정 보류\'인 항목은 그 수치가 맞다고 전제하지 마. " +
  "다만 **질문은 만들어도 된다.** 수치를 근거로 삼는 대신 \'이 검사를 다시 받아야 하는지\', " +
  "\'원본 결과지에서 확인해 줄 수 있는지\'를 묻는 식으로 쓴다.\n" +
  "6. 진단·처방하지 말고 참고 정보 톤을 유지해.\n" +
  "7. **임신 주차가 주어지면 그 주차에 맞춰 써.** 같은 수치라도 주차에 따라 의미가 " +
  "다르다 — 예: 헤모글로빈 기준은 1분기 11.0 / 2분기 10.5 / 3분기 11.0이고, 2분기에는 " +
  "혈액량이 늘어 수치가 낮아지는 게 자연스럽다. 임신성 당뇨 선별은 24~28주, 빈혈 재검도 " +
  "24~28주에 한다. 지금 주차에서 곧 받게 될 검사나 챙길 것이 있으면 자연스럽게 언급해. " +
  "다만 **주차 때문에 판정을 바꾸지는 마** — 판정은 이미 주차를 반영해서 확정됐다.\n" +
  "8. 주차가 '알 수 없음'으로 주어지면 주차 이야기를 아예 꺼내지 말고, 대신 마지막에 " +
  "'임신 주차를 입력하면 주차에 맞는 기준으로 더 정확히 볼 수 있어요' 한 문장을 덧붙여.\n\n" +
  "## 작성할 것\n" +
  "1) summary: 이번 결과 전체를 3~5문장으로 요약. 첫 문장은 지금 임신 주차를 언급하며 시작해 " +
  "(예: \"임신 28주차에 받은 이번 검사는…\"). 신경 쓸 항목이 있으면 항목명·수치와 " +
  "함께 왜 그런지 짚어주고, 전부 안심이면 안정적이라는 점을 강조해. 검사지 기준과 임신 " +
  "중 기준이 다른 항목이 있으면(입력의 \'대조\' 줄) 그 점을 꼭 알려줘 — 사용자가 검사지의 " +
  "빨간 표시를 보고 불안해하던 부분이라 가장 도움이 되는 정보다.\n" +
  "2) questions: 다음 진료 때 물어볼 질문 2~4개를 **네가 직접 써.**\n" +
  "   - 입력의 \'참고문장\'은 어떤 항목이 중요한지 알려주는 힌트일 뿐이다. **그대로 베끼지 마.** " +
  "같은 뜻이라도 네 문장으로, 그 항목의 수치·기준·주차를 넣어 구체적으로 다시 써.\n" +
  "   - 각 질문은 **서로 다른 항목**을 다뤄야 한다. 같은 형식의 문장을 여러 개 만들지 마 " +
  "(예: \'A 결과가 애매한데 어떻게 볼까요? / B 결과가 애매한데 어떻게 볼까요?\'처럼 " +
  "항목명만 바꾼 복제는 금지).\n" +
  "   - 좋은 질문은 이렇다: \'헤모글로빈이 10.8 g/dL로 임신 2분기 기준(10.5) 바로 위인데, " +
  "철분제를 시작해야 할까요?\' / \'백혈구가 5.6으로 조금 낮게 나왔는데 감염 검사가 필요할까요?\'\n" +
  "   - 나쁜 질문은 이렇다: \'결과가 애매한 구간이라고 나왔는데 어떻게 보면 될까요?\' " +
  "(수치도 기준도 없어서 의사에게 아무 정보를 주지 못한다)\n" +
  "   - 결과값이 아예 없는 항목(\'결과 없음\')으로는 만들지 마.\n" +
  "   - **questions는 어떤 경우에도 빈 배열이면 안 된다. 최소 2개는 반드시 채워라.**\n" +
  "     쓸 만한 항목이 없거나 대부분이 \'확인 필요\'라면, 지금 임신 주차에 맞는 일반적인 " +
  "산전 관리 질문으로 채워라(예: \'28주차인데 지금 챙겨야 할 검사가 더 있을까요?\', " +
  "\'이번 결과지에서 다시 확인해야 할 항목이 있을까요?\'). 빈손으로 돌려보내지 마.\n" +
  "3) foods: 신경 쓸 항목을 보완하는 데 도움이 될 음식 3~6개. 각 음식은 name과 " +
  "reason(왜 도움되는지 1문장). 전부 안심이면 임신 중 전반적으로 도움되는 음식으로 대체해도 돼.\n" +
  "**name은 반드시 아래 재료 목록 안에서만 고르고, 목록에 적힌 이름 그대로(괄호·수식어 없이) 써. " +
  "목록에 없는 재료는 절대 추천하지 말고, 같은 재료를 두 번 넣지 마.**\n" +
  `사용 가능한 재료 목록: ${RECOMMENDABLE_FOODS.join(", ")}. ` +
  '출력은 반드시 JSON 객체 하나로만: {"summary": string, "questions": string[], "foods": [{"name": string, "reason": string}]}.';


/**
 * 출력 모양을 프롬프트가 아니라 스키마로 못 박는다.
 * 문장으로 부탁하면 지시문이 길어질수록 무시되고, 실제로 questions 키가
 * 통째로 빠진 응답이 반복해서 왔다.
 */
const SCHEMA_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "report_insights",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "questions", "foods"],
      properties: {
        summary: {
          type: "string",
          description: "이번 검사 결과 전체를 3~5문장으로 요약한 종합 소견",
        },
        // 주의: OpenAI structured outputs(strict)는 minItems/maxItems를 지원하지
        // 않는다. 넣으면 400이 나고 json_object 폴백으로 떨어져서 questions 키가
        // 통째로 사라진다. 개수 제약은 description/프롬프트로만 건다.
        questions: {
          type: "array",
          items: { type: "string" },
          description:
            "다음 진료 때 의사에게 물어볼 질문 2~4개. 항목명과 수치를 넣어 구체적으로. 빈 배열 금지",
        },
        foods: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "reason"],
            properties: {
              name: { type: "string", description: "제공된 재료 목록 안의 이름 그대로" },
              reason: { type: "string", description: "왜 도움이 되는지 1문장" },
            },
          },
        },
      },
    },
  },
} as const;

export type ReportFood = { name: string; reason: string };

export type ReportInsights = {
  summary: string;
  questions: string[];
  foods: ReportFood[];
};

/**
 * 모델이 JSON 앞뒤에 설명이나 ```json 코드펜스를 붙여 보내는 경우가 있어,
 * 가장 바깥 중괄호 구간만 떼어낸다. response_format을 걸어도 100%는 아니다.
 */
/**
 * 모델이 questions를 어떤 모양으로 주든 문자열 목록으로 만든다.
 *
 * 스키마로 string[]을 요구해도 실제로는 [{content}], [{question}], [{text}]처럼
 * 객체 배열로 오는 경우가 있다. 예전 파서는 typeof q === "string"이 아니면 전부
 * 버려서, 응답은 멀쩡한데 화면에는 질문이 하나도 없는 상태가 됐다.
 * (원인을 못 찾고 프롬프트만 계속 고치게 만든 버그다.)
 */
function toStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      const t = entry.trim();
      if (t) out.push(t);
      continue;
    }
    if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      const candidate = o.content ?? o.question ?? o.text ?? o.q ?? o.value;
      if (typeof candidate === "string" && candidate.trim()) out.push(candidate.trim());
    }
  }
  return out;
}

function extractJsonObject(raw: string): string {
  const text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

function itemsToText(items: ParsedTestItem[]) {
  // 질문·소견의 재료가 되는 항목만 넘긴다.
  // 요침사처럼 "Not found / 기준 없음"만 수십 줄인 검사지가 있는데, 그대로 넣으면
  // 입력이 길어지기만 하고 모델이 쓸 만한 질문을 만들지 못한다.
  const meaningful = items.filter((it) => it.engineStatus !== "info_only");
  const target = meaningful.length > 0 ? meaningful : items;
  return target
    .map((item) => {
      const status = item.badgeLabel || item.status;
      const lines = [`- ${item.name}: ${item.value || "정보 없음"} (${status})`];
      const note = item.verdict || item.definition || "";
      if (note) lines.push(`  설명: ${note}`);
      if (item.basisLabel) lines.push(`  판정기준: ${item.basisLabel}`);
      if (item.contrastNote) lines.push(`  대조: ${item.contrastNote}`);
      if (item.caveats?.length) lines.push(`  주의: ${item.caveats.join(" / ")}`);
      if (item.trendNote) lines.push(`  변화: ${item.trendNote}`);
      if (item.doctorQuestion) lines.push(`  참고문장(베끼지 말 것): ${item.doctorQuestion}`);
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

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        `## 사용자 정보\n${weekContext(ctx.gestationalWeek)}` +
        (ctx.flags?.length ? `\n상황: ${ctx.flags.join(", ")}` : "") +
        `\n\n## 이번 산전 검사 결과 (판정은 이미 확정됨)\n${itemsToText(items)}\n\n` +
        `위 내용을 바탕으로 지시한 JSON 형식으로 작성해줘. 판정은 바꾸지 말고, 임신 주차에 맞춰 설명해줘.`,
    },
  ];

  async function call(useSchema: boolean) {
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        response_format: useSchema ? SCHEMA_RESPONSE_FORMAT : { type: "json_object" },
        messages,
        max_tokens: 2000,
      }),
    });
  }

  // 스키마를 못 받는 구형 모델이면 400이 온다. 그때만 예전 방식으로 한 번 더 시도한다.
  let response = await call(true);
  if (!response.ok && response.status === 400) {
    // 400의 진짜 사유를 반드시 남긴다. 예전에 스키마의 minItems 때문에 400이 났는데
    // 로그가 "미지원으로 판단"뿐이라, 조용히 json_object로 떨어진 걸 모른 채
    // 프롬프트만 계속 고쳤다.
    const why = await response.text().catch(() => "");
    console.warn("[insights] json_schema 400 -> json_object 폴백. 사유:", why.slice(0, 500));
    response = await call(false);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenAI 요청 실패 (${response.status}): ${errText.slice(0, 300)}`);
  }

  const json = await response.json();
  const choice = json?.choices?.[0];
  const content: string | undefined = choice?.message?.content;
  if (!content) throw new Error("OpenAI 응답에서 결과를 찾지 못했어요.");

  // 토큰 한도에 걸려 잘린 경우, 파싱 실패의 진짜 이유를 알려준다.
  // ("JSON으로 해석하지 못했어요"만 보면 프롬프트 문제로 오해하게 된다.)
  if (choice?.finish_reason === "length") {
    throw new Error(
      "OpenAI 응답이 토큰 한도에 걸려 중간에 끊겼어요. max_tokens를 늘려야 합니다.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(content));
  } catch {
    // 무엇이 왔는지 모르면 고칠 수가 없어서 앞부분을 함께 남긴다.
    throw new Error(
      `OpenAI 응답을 JSON으로 해석하지 못했어요. 받은 내용 앞부분: ${content.slice(0, 200)}`,
    );
  }

  const summary =
    typeof (parsed as { summary?: unknown })?.summary === "string"
      ? (parsed as { summary: string }).summary.trim()
      : "";

  const rawQuestions = (parsed as { questions?: unknown })?.questions;
  const questions = toStringList(rawQuestions);

  // 재료는 이미지가 준비된 30가지(lib/foods.ts)만 노출한다. 모델이 목록 밖 재료를
  // 내놓거나 이름에 수식어를 붙이면 여기서 정규화하고, 못 맞추면 버린다.
  const rawFoods = (parsed as { foods?: unknown })?.foods;
  const seenFoods = new Set<string>();
  const foods = Array.isArray(rawFoods)
    ? rawFoods
        .filter(
          (food): food is { name: string; reason?: unknown } =>
            !!food &&
            typeof food === "object" &&
            typeof ((food as any).name ?? (food as any).content) === "string" &&
            String((food as any).name ?? (food as any).content).trim().length > 0,
        )
        .map((food) => ({
          name: normalizeFoodName(String((food as any).name ?? (food as any).content)),
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
  if (questions.length === 0) {
    // 조용히 빈 배열을 돌려주면 화면은 엔진 fallback으로 떨어지고,
    // 우리는 "AI가 왜 안 만들지"를 계속 추측하게 된다.
    // 실제로 무엇이 왔는지를 에러에 그대로 담아 한 번에 원인을 보게 한다.
    const keys = parsed && typeof parsed === "object" ? Object.keys(parsed).join(",") : typeof parsed;
    throw new Error(
      `추천 질문이 비어 있어요. 응답 키=[${keys}] questions=${JSON.stringify(rawQuestions)?.slice(0, 300)}`,
    );
  }

  return { summary, questions, foods };
}
