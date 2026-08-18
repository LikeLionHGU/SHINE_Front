import { FOOD_IMAGE_SOURCES } from "@/lib/food-images";
import { normalizeFoodName } from "@/lib/foods";
import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";

// 디자인상 추천 재료 썸네일은 가로 37px. 세로는 원본 비율(≈1:1)에 맞춰 같은 값을 쓴다.
export const FOOD_IMAGE_WIDTH = 37;

// 재료 이름으로 이미지를 찾아 보여준다. AI가 목록(lib/foods.ts) 밖 이름을 주거나
// 서버 추천 재료라 이미지가 아직 없는 경우에는 같은 크기의 빈 자리를 남겨서
// 칩 높이가 흔들리지 않게 한다.
export function FoodImage({ name }: { name: string }) {
  const key = normalizeFoodName(name);
  const source = key ? FOOD_IMAGE_SOURCES[key] : undefined;
  if (!source) return <View style={styles.image} />;
  return <Image source={source} style={styles.image} contentFit="contain" transition={0} />;
}

const styles = StyleSheet.create({
  image: { width: FOOD_IMAGE_WIDTH, height: FOOD_IMAGE_WIDTH },
});
