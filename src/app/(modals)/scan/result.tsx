import { CloseIcon, XXLogoIcon } from "@/components/icons";
import { useScrollToTop } from "@/lib/use-scroll-top";
import { headerBar } from "@/lib/theme";
import { centeredContentStyle, centeredSheetStyle } from "@/lib/layout";
import { DEMO_SUMMARY } from "@/lib/report";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// 검사지 분석 4단계: 종합 분석 결과. analyzing.tsx에서 이미 이 사진을
// "분석" 탭이 볼 최근 검사지로 저장해뒀으므로, 여기서는 짧게 완료를 보여주고
// "분석 보러가기"로 실제 상세(쉬운 번역본 화면, node 671:4356)로 이어준다.
// (현재는 analyzing.tsx가 이 화면을 거치지 않고 report.tsx로 바로
// dismissTo하기 때문에 실제 앱 흐름에서는 도달하지 않는 레거시 화면이다 —
// 그래도 스타일은 다른 화면과 일관되게 반응형으로 맞춰둔다.)
export default function ScanResult() {
  // 화면에 들어올 때마다 스크롤을 맨 위로 되돌린다.
  const scrollRef = useScrollToTop();
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  // report.tsx와 동일하게, 고정 height 대신 사진 원본 비율로 보여준다.
  const [imageAspect, setImageAspect] = useState(310.088 / 320);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (width, height) => {
        if (width > 0 && height > 0) setImageAspect(width / height);
      },
      () => {},
    );
  }, [uri]);

  function goHome() {
    router.dismissTo("/(tabs)/home");
  }

  function goToAnalysis() {
    router.dismissTo("/(tabs)/analysis");
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <XXLogoIcon />
          <Pressable hitSlop={8} onPress={goHome}>
            <CloseIcon size={24} />
          </Pressable>
        </View>
        <ScrollView ref={scrollRef} style={centeredContentStyle} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>검사지 분석이{"\n"}완료됐어요</Text>
          {!!uri && <Image source={{ uri }} style={[styles.preview, { aspectRatio: imageAspect }]} resizeMode="contain" />}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>쉬운 번역본</Text>
            <Text style={styles.summaryText}>{DEMO_SUMMARY}</Text>
          </View>
        </ScrollView>
        <View style={[centeredSheetStyle, styles.actions]}>
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={goHome}>
            <Text style={styles.secondaryButtonText}>홈으로</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]} onPress={goToAnalysis}>
            <Text style={styles.homeButtonText}>분석 보러가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
header: { ...headerBar, justifyContent: "space-between", paddingHorizontal: 16 },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, gap: 16 },
  heading: { color: "#4C4C4C", fontFamily: "Pretendard-SemiBold", fontSize: 24, lineHeight: 32 },
  preview: { width: "100%", borderRadius: 14, backgroundColor: "#FFF0F6" },
  summaryCard: { padding: 18, borderRadius: 14, backgroundColor: "#FFFCFD", gap: 6 },
  summaryTitle: { color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16 },
  summaryText: { color: "#707070", fontFamily: "Pretendard-Regular", fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.78 },
  actions: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 12 },
  secondaryButton: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#FA0C56", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#FA0C56", fontFamily: "Pretendard-SemiBold", fontSize: 16 },
  homeButton: { flex: 1.4, height: 46, borderRadius: 12, backgroundColor: "#FA0C56", alignItems: "center", justifyContent: "center" },
  homeButtonText: { color: "#FFFDF9", fontFamily: "Pretendard-SemiBold", fontSize: 16, letterSpacing: 1.2 },
});
