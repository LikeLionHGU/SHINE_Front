import type { RecommendableFood } from "@/lib/foods";
import type { ImageSourcePropType } from "react-native";

// 재료 이름 → 썸네일 이미지(assets/images/foods/*.png). 피그마에서 내보낸 30종을
// 그대로 쓰고, 표시는 components/food-image.tsx에서 가로 37px로 한다.
// Metro는 정적 경로만 번들에 포함하므로 require를 하나씩 적어둔다.
export const FOOD_IMAGE_SOURCES: Partial<Record<RecommendableFood, ImageSourcePropType>> = {};
