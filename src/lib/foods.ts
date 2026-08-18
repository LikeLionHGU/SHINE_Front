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

// 같은 재료를 다르게 부르는 표현들. 서버도 "계란 → 달걀" 정도는 맞춰주지만,
// 프론트에서 먼저 걸러내면 목록 밖으로 보고 버리는 일이 없다.
const FOOD_ALIASES: Record<string, RecommendableFood> = {
  계란: "달걀",
  달걀흰자: "달걀",
  쇠고기: "소고기",
  한우: "소고기",
  닭고기: "닭가슴살",
  요거트: "그릭요거트",
  요구르트: "그릭요거트",
  플레인요거트: "그릭요거트",
  렌즈콩: "렌틸콩",
  오트밀: "귀리",
  귀리밥: "귀리",
  현미밥: "현미",
  브로컬리: "브로콜리",
  표고: "표고버섯",
  파프리카빨강: "파프리카",
  김구이: "김",
  조미김: "김",
  미역국: "미역",
  참깨가루: "참깨",
  검정콩: "검은콩",
  서리태: "검은콩",
};

// AI가 "시금치(익힌 것)", "삶은 달걀"처럼 살을 붙여 답하는 경우가 있어서,
// 공백·괄호를 걷어내고 별칭·부분일치까지 확인한다.
export function normalizeFoodName(raw: string): RecommendableFood | null {
  const name = raw.replace(/\(.*?\)/g, "").replace(/\s+/g, "").trim();
  if (!name) return null;
  if (FOOD_SET.has(name)) return name as RecommendableFood;
  if (FOOD_ALIASES[name]) return FOOD_ALIASES[name];
  const matched = RECOMMENDABLE_FOODS.find((food) => name.includes(food));
  if (matched) return matched;
  const aliasKey = Object.keys(FOOD_ALIASES).find((alias) => name.includes(alias));
  return aliasKey ? FOOD_ALIASES[aliasKey] : null;
}

export function isRecommendableFood(name: string): boolean {
  return normalizeFoodName(name) !== null;
}
