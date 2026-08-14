import { saveLastReport, takePendingScan, type ParsedTestItem, type ReportFood } from "@/lib/report";
import { parseTestReport } from "@/lib/ocr";
import { generateReportInsights } from "@/lib/insights";
import { scanDocumentImage } from "@/lib/scan";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BAR_WIDTHS = [100.8, 100.8, 83.2, 73.6];
const MIN_VISIBLE_MS = 1200;

// Figma(node 837:4612 검사지 분석-스캔): "업로드한 사진을 스캔 후 검사 결과를
// 보기 쉽게 바꾸는 중이에요" + 스캔 라인 4개. scan/date-confirm.tsx가 스캔+OCR+
// 날짜 확인까지 미리 끝내고 setPendingScan으로 결과를 넘겨두면, 이 화면은
// takePendingScan으로 그 결과를 그대로 받아 쓰고 다시 스캔·파싱하지 않는다.
// (date-confirm을 거치지 않고 이 화면으로 바로 들어온 경우를 대비해, pendingScan이
// 없으면 예전처럼 scanDocumentImage + parseTestReport를 직접 실행하는 방어 경로도
// 남겨뒀다.) 검사항목이 있으면 generateReportInsights(lib/insights.ts)로 종합
// 소견/추천 질문/추천 음식까지 생성해서 함께 저장한다 — report.tsx의 "종합 분석",
// "질문 입력하기", "추천 재료" 칸이 이 값을 보여준다. 처리가 너무 빨리 끝나도
// 애니메이션이 최소 MIN_VISIBLE_MS만큼은 보이도록 한다.
export default function ScanAnalyzing() {
  const router = useRouter();
  const { uri, testDate } = useLocalSearchParams<{ uri?: string; testDate?: string }>();
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
      let resolvedTestDate = testDate;

      if (uri) {
        const pending = takePendingScan(uri);
        if (pending) {
          // date-confirm.tsx가 이미 스캔·OCR·날짜 확인까지 끝내둔 결과를 그대로 쓴다.
          finalUri = pending.uri;
          items = pending.items;
          resolvedTestDate = pending.testDate ?? resolvedTestDate;
        } else {
          // pendingScan이 없는 경우(예: date-confirm을 거치지 않고 바로 들어온 경우)를
          // 대비한 방어 경로 — 예전처럼 여기서 직접 스캔·파싱한다.
          try {
            finalUri = await scanDocumentImage(uri);
          } catch {
            // 스캔 처리에 실패해도 원본 사진으로 계속 진행한다.
            finalUri = uri;
          }

          try {
            const result = await parseTestReport(finalUri);
            items = result.items;
          } catch (error) {
            // OCR 파싱이 실패해도(키 미설정, 네트워크 오류 등) 스캔 자체는
            // 계속 진행한다 — 종합분석 칸은 기본 문구로 대체된다.
            console.warn("[scan] 검사지 OCR 파싱 실패:", error);
            items = undefined;
          }
        }
      }

      let summary: string | undefined;
      let questions: string[] | undefined;
      let foods: ReportFood[] | undefined;

      if (items && items.length > 0) {
        try {
          const insights = await generateReportInsights(items);
          summary = insights.summary;
          questions = insights.questions;
          foods = insights.foods;
        } catch (error) {
          // 종합 소견 생성이 실패해도(키 미설정, 네트워크 오류 등) 검사항목
          // 표는 그대로 보여준다 — 종합 분석/질문/추천 재료 칸은 기본 문구로 대체된다.
          console.warn("[scan] AI 종합 분석 생성 실패:", error);
        }
      }

      await minVisible;
      if (cancelled) return;

      if (finalUri) {
        await saveLastReport({ uri: finalUri, items, testDate: resolvedTestDate, summary, questions, foods }).catch(
          () => {},
        );
      }
      router.dismissTo("/(tabs)/analysis/report");
    })();

    return () => {
      cancelled = true;
      loop.stop();
    };
  }, [pulse, router, uri, testDate]);

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
