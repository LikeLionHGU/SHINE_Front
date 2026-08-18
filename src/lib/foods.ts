// AI(lib/insights.ts)가 추천할 수 있는 재료 화이트리스트.
// 디자인상 재료마다 전용 이미지가 붙기 때문에, 이미지가 준비된 30가지 안에서만
// 추천하도록 프롬프트와 응답 필터 양쪽에서 이 목록을 사용한다.
export const RECOMMENDABLE_FOODS = [
  "시금치",
  "브로콜리",
  "파프리카",
  "표고버섯",
  "케일",
  "당근",
  "토마토",
  "아스파라거스",
  "아보카도",
  "딸기",
  "오렌지",
  "키위",
  "바나나",
  "두부",
  "검은콩",
  "렌틸콩",
  "고구마",
  "귀리",
  "현미",
  "연어",
  "고등어",
  "굴",
  "소고기",
  "닭가슴살",
  "달걀",
  "우유",
  "그릭요거트",
  "김",
  "미역",
  "참깨",
] as const;

export type RecommendableFood = (typeof RECOMMENDABLE_FOODS)[number];

const FOOD_SET = new Set<string>(RECOMMENDABLE_FOODS);

// AI가 "시금치(익힌 것)", "삶은 달걀"처럼 살을 붙여 답하는 경우가 있어서,
// 공백·괄호를 걷어내고 목록 안의 이름이 포함되는지까지 확인한다.
export function normalizeFoodName(raw: string): RecommendableFood | null {
  const name = raw.replace(/\(.*?\)/g, "").replace(/\s+/g, "").trim();
  if (!name) return null;
  if (FOOD_SET.has(name)) return name as RecommendableFood;
  const matched = RECOMMENDABLE_FOODS.find((food) => name.includes(food));
  return matched ?? null;
}

export function isRecommendableFood(name: string): boolean {
  return normalizeFoodName(name) !== null;
}
