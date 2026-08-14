import { saveLastReport, type ParsedTestItem } from "@/lib/report";
import { parseTestReport } from "@/lib/ocr";
import { scanDocumentImage } from "@/lib/scan";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BAR_WIDTHS = [100.8, 100.8, 83.2, 73.6];
const MIN_VISIBLE_MS = 1200;

// Figma(node 837:4612 검사지 분석-스캔): "업로드한 사진을 스캔 후 검사 결과를
// 보기 쉽게 바꾸는 중이에요" + 스캔 라인 4개. 이 화면에서 실제로
// scanDocumentImage(lib/scan.ts)로 사진을 정리(방향 보정)하고,
// parseTestReport(lib/ocr.ts)로 검사항목/수치/상태를 OCR로 읽어낸 다음,
// 그 결과를 "분석" 탭이 보여줄 최근 검사지로 저장한다. 처리가 너무 빨리
// 끝나도 애니메이션이 최소 MIN_VISIBLE_MS만큼은 보이도록 한다.
export default function ScanAnalyzing() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();

    let cancelled = false;

    (async () => {
      const minVisible = new Promise<void>((resolve) => setTimeout(resolve, MIN_VISIBLE_MS));

      let finalUri = uri ?? null;
      let items: ParsedTestItem[] | undefined;

      if (uri) {
        try {
          finalUri = await scanDocumentImage(uri);
        } catch {
          // 스캔 처리에 실패해도 원본 사진으로 계속 진행한다.
          finalUri = uri;
        }

        try {
          items = await parseTestReport(finalUri);
        } catch (error) {
          // OCR 파싱이 실패해도(키 미설정, 네트워크 오류 등) 스캔 자체는
          // 계속 진행한다 — 종합분석 칸은 기본 문구로 대체된다.
          console.warn("[scan] 검사지 OCR 파싱 실패:", error);
          items = undefined;
        }
      }

      await minVisible;
      if (cancelled) return;

      if (finalUri) {
        await saveLastReport(finalUri, items).catch(() => {});
      }
      router.dismissTo("/(tabs)/analysis/report");
    })();

    return () => {
      cancelled = true;
      loop.stop();
    };
  }, [pulse, router, uri]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.text}>업로드한 사진을 스캔 후{"\n"}검사 결과를 보기 쉽게 바꾸는 중이에요</Text>
          <View style={styles.bars}>
            {BAR_WIDTHS.map((width, index) => (
              <Animated.View key={index} style={[styles.bar, { width, opacity: pulse }]} />
            ))}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 48 },
  text: { color: "#A0A0A0", fontFamily: "Pretendard-Medium", fontSize: 14, lineHeight: 22, textAlign: "center" },
  bars: { width: 100.8, gap: 4.8, alignItems: "flex-start" },
  bar: { height: 3.2, borderRadius: 220, backgroundColor: "#FA0C56" },
});
