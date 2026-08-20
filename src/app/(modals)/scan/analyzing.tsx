import { saveLastReport, clearReportEdits, takePendingScan, type ParsedTestItem, type ReportFood } from "@/lib/report";
import { parseTestReport } from "@/lib/ocr";
import { generateReportInsights } from "@/lib/insights";
import { scanDocumentImage } from "@/lib/scan";
import { currentPregnancyWeek, pregnancyWeekAt } from "@/lib/pregnancy";
import { reanalyzeItems } from "@/lib/labs/bridge";
import { colors, font, tracking } from "@/lib/theme";
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
// 소견/추천 질문/추천 음식까지 생성한다.
//
// 그렇게 만든 결과 전체를 서버(POST /api/v1/reports)로 보내고, 서버가 **임신 기준으로
// 다시 판정한 교정본**을 받아 저장한다 — 검사지에 인쇄된 참고치는 비임신 기준인
// 경우가 많아서(혈색소 11.5 → 검사지 기준 "주의", 임신 기준 "안심") 화면에는
// 서버 판정을 보여줘야 맞다. 항목명도 카탈로그 대표명("헤모글로빈" → "혈색소")으로
// 통일돼 돌아온다. 전송이 실패하면 프론트 OCR 결과 그대로 저장해 화면은 살려둔다.
//
// report.tsx의 "종합 분석", "질문 입력하기", "추천 재료" 칸이 이 값을 보여준다.
// 처리가 너무 빨리 끝나도 애니메이션이 최소 MIN_VISIBLE_MS만큼은 보이도록 한다.
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
      // 판정 엔진이 함께 돌려주는 값들 — 항목 하나만 봐서는 안 보이는 소견,
      // 아직 지원하지 않는 항목, 화면 하단에 표기할 출처 목록.
      let crossFindings: Awaited<ReturnType<typeof parseTestReport>>["crossFindings"] | undefined;
      let unsupported: Awaited<ReturnType<typeof parseTestReport>>["unsupported"] | undefined;
      let sources: Awaited<ReturnType<typeof parseTestReport>>["sources"] | undefined;
      let unreadable: Awaited<ReturnType<typeof parseTestReport>>["unreadable"] | undefined;

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
            // 검사일은 OCR이 읽어내야 알 수 있어서, 이 첫 판정은 오늘 기준의
            // 임시값으로 돌린다. 아래에서 검사일이 확정되면 다시 판정한다.
            const provisionalWeek = await currentPregnancyWeek();
            const result = await parseTestReport(finalUri, {
              gestationalWeek: provisionalWeek,
            });
            items = result.items;
            crossFindings = result.crossFindings;
            unsupported = result.unsupported;
            sources = result.sources;
            unreadable = result.unreadable;
            resolvedTestDate = resolvedTestDate ?? toStoredDate(result.reportDate);
          } catch (error) {
            // OCR 파싱이 실패해도(키 미설정, 네트워크 오류 등) 스캔 자체는
            // 계속 진행한다 — 종합분석 칸은 기본 문구로 대체된다.
            console.warn("[scan] 검사지 OCR 파싱 실패:", error);
            items = undefined;
          }
        }
      }

      // 임신 주차는 '오늘'이 아니라 **검사받은 날** 기준이어야 한다.
      // 두 달 전 검사지를 지금 올리면, 지금 30주차라도 그 검사는 22주차 기준으로
      // 봐야 판정(삼분기별 기준)도 AI 설명도 맞는다.
      //
      // 이 주차는 두 군데에 쓰인다.
      //  (1) 판정 엔진 — 삼분기별 기준(헤모글로빈 11 / 10.5 / 11 등)을 고르는 데
      //  (2) AI 종합 분석 프롬프트 — "임신 22주차에 받은 이번 검사는…" 처럼 주차에 맞춰 설명하게
      const gestationalWeek = await pregnancyWeekAt(resolvedTestDate);

      // 위 두 경로(date-confirm이 넘겨준 결과 / 여기서 직접 읽은 결과) 모두
      // 검사일을 알기 전의 임시 주차로 판정돼 있다. 검사일이 확정된 지금 다시 판정한다.
      // OCR을 다시 부르지 않고 이미 읽어둔 값만 재판정하므로 비용이 들지 않는다.
      if (items && items.length > 0) {
        const re = reanalyzeItems(items, { gestationalWeek });
        items = re.items;
        crossFindings = re.crossFindings;
        unsupported = re.unsupported;
        sources = re.sources;
      }

      let summary: string | undefined;
      let questions: string[] | undefined;
      let foods: ReportFood[] | undefined;

      if (items && items.length > 0) {
        try {
          const insights = await generateReportInsights(items, { gestationalWeek });
          summary = insights.summary;
          questions = insights.questions;
          foods = insights.foods;
        } catch (error) {
          // 종합 소견 생성이 실패해도(키 미설정, 네트워크 오류 등) 검사항목
          // 표는 그대로 보여준다 — 종합 분석/질문/추천 재료 칸은 기본 문구로 대체된다.
          console.warn("[scan] AI 종합 분석 생성 실패:", error);
        }
      }

      // 서버 전송은 여기서 하지 않는다.
      //
      // 예전에는 스캔이 끝나자마자 자동으로 POST /reports를 보냈다. 그런데 이 시점의
      // 값은 아직 사용자가 확인하기 전이라, OCR이 잘못 읽은 수치가 그대로 서버에
      // 기록으로 남았다. 지금은 결과 화면에서 값을 확인·수정한 뒤 "저장하기"를
      // 눌렀을 때만 서버로 보낸다(analysis/report.tsx의 saveToServer).

      await minVisible;
      if (cancelled) return;

      if (finalUri) {
        // 새 검사지를 올렸으니 이전 검사지에 대한 수정분은 더 이상 유효하지 않다.
        await clearReportEdits("last").catch(() => {});
        await saveLastReport({
          uri: finalUri,
          items,
          testDate: resolvedTestDate,
          summary,
          questions,
          foods,
          crossFindings,
          unsupported,
          sources,
          unreadable,
        }).catch(() => {});
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
      <LinearGradient colors={[colors.bgFrom, colors.bgTo]} style={StyleSheet.absoluteFill} />
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

/** OCR이 읽은 "2026-08-20" → 앱이 쓰는 "26.08.20". 못 읽었으면 undefined. */
function toStoredDate(reportDate: string | null): string | undefined {
  if (!reportDate) return undefined;
  const [year, month, day] = reportDate.split("-");
  if (!year || !month || !day) return undefined;
  return `${year.slice(2)}.${month}.${day}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 48 },
  // Figma 837:4616 — Medium 14 / 행간 22 / 자간 -0.42 / #A0A0A0, 296px 폭에서 2줄.
  text: {
    fontFamily: font.medium,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: tracking(14),
    color: colors.textHint,
    textAlign: "center",
  },
  // Figma 837:4617 — 100.8 폭 블록, 막대 4개(h3.2, 간격 4.8, r440).
  bars: { width: 100.8, gap: 4.8, alignItems: "flex-start" },
  bar: { height: 3.2, borderRadius: 220, backgroundColor: colors.brandStrong },
});
