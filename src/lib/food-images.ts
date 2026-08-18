import type { RecommendableFood } from "@/lib/foods";
import type { ImageSourcePropType } from "react-native";

// 재료 이름 → 썸네일 이미지(assets/images/foods/*.png). 피그마에서 내보낸 30종을
// 가로 111px(표시 크기 37px의 3배)로 줄여 저장했고, 실제 표시는
// components/food-image.tsx에서 가로 37px로 한다.
// Metro는 정적 경로만 번들에 포함하므로 require를 하나씩 적어둔다.
export const FOOD_IMAGE_SOURCES: Record<RecommendableFood, ImageSourcePropType> = {
  시금치: require("../../assets/images/foods/spinach.png"),
  브로콜리: require("../../assets/images/foods/broccoli.png"),
  파프리카: require("../../assets/images/foods/bell-pepper.png"),
  표고버섯: require("../../assets/images/foods/shiitake.png"),
  케일: require("../../assets/images/foods/kale.png"),
  당근: require("../../assets/images/foods/carrot.png"),
  토마토: require("../../assets/images/foods/tomato.png"),
  아스파라거스: require("../../assets/images/foods/asparagus.png"),
  아보카도: require("../../assets/images/foods/avocado.png"),
  딸기: require("../../assets/images/foods/strawberry.png"),
  오렌지: require("../../assets/images/foods/orange.png"),
  키위: require("../../assets/images/foods/kiwi.png"),
  바나나: require("../../assets/images/foods/banana.png"),
  두부: require("../../assets/images/foods/tofu.png"),
  검은콩: require("../../assets/images/foods/black-bean.png"),
  렌틸콩: require("../../assets/images/foods/lentil.png"),
  고구마: require("../../assets/images/foods/sweet-potato.png"),
  귀리: require("../../assets/images/foods/oat.png"),
  현미: require("../../assets/images/foods/brown-rice.png"),
  연어: require("../../assets/images/foods/salmon.png"),
  고등어: require("../../assets/images/foods/mackerel.png"),
  굴: require("../../assets/images/foods/oyster.png"),
  소고기: require("../../assets/images/foods/beef.png"),
  닭가슴살: require("../../assets/images/foods/chicken-breast.png"),
  달걀: require("../../assets/images/foods/egg.png"),
  우유: require("../../assets/images/foods/milk.png"),
  그릭요거트: require("../../assets/images/foods/greek-yogurt.png"),
  김: require("../../assets/images/foods/gim.png"),
  미역: require("../../assets/images/foods/miyeok.png"),
  참깨: require("../../assets/images/foods/sesame.png"),
};
