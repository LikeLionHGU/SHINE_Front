import { saveLastReport, clearReportEdits, takePendingScan, type ParsedTestItem, type ReportFood } from "@/lib/report";
import { parseTestReport } from "@/lib/ocr";
import { generateReportInsights } from "@/lib/insights";
import { scanDocumentImage } from "@/lib/scan";
import { currentPregnancyWeek } from "@/lib/pregnancy";
import { submitReport } from "@/lib/api";
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

      // 임신 주차는 두 군데에 쓰인다.
      //  (1) 판정 엔진 — 삼분기별 기준(헤모글로빈 11 / 10.5 / 11 등)을 고르는 데
      //  (2) AI 종합 분석 프롬프트 — "임신 28주차에 받은 이번 검사는…" 처럼 주차에 맞춰 설명하게
      // 한 번만 구해서 둘 다 넘긴다.
      const gestationalWeek = await currentPregnancyWeek();

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
            const result = await parseTestReport(finalUri, { gestationalWeek });
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

      // 서버에 올리고 교정본을 받아온다. 검사항목이 하나도 없으면 보낼 게 없다.
      let testSheetId: number | undefined;
      let week: string | undefined;

      if (items && items.length > 0) {
        try {
          const corrected = await submitReport({
            testDate: resolvedTestDate,
            items,
            summary,
            questions,
            foods,
          });

          // 서버가 임신 기준으로 다시 판정하고 대표명·검수된 설명으로 바꿔준 값으로 교체한다.
          // 이때 항목명이 "헤모글로빈" → "혈색소"로 바뀌므로, 사용자가 손에 든 검사지와
          // 대조할 수 있도록 OCR이 읽은 원문명을 같이 붙여둔다. 서버가 원문을 돌려주지
          // 않아서 순서로 짝짓는데, 개수가 다르면 잘못 붙을 수 있으니 그때는 포기한다.
          // 서버도 임신 기준으로 다시 판정해서 돌려주지만, 그 판정에는 근거(출처)가
          // 붙어 있지 않다. 프론트 판정 엔진(lib/labs)은 학회 원문까지 인용을 달고
          // 오므로, **판정·설명·근거는 엔진 결과를 그대로 유지**하고 서버에서는
          // 카탈로그 대표명("헤모글로빈" → "혈색소")만 빌려온다.
          // (엔진이 판정하지 못한 항목은 서버 값이라도 보여주는 게 낫기 때문에
          //  engineStatus가 없는 항목만 서버 값으로 대체한다.)
          if (corrected?.items?.length && items?.length) {
            const sameLength = items.length === corrected.items.length;
            items = items.map((item, i) => {
              const fromServer = sameLength ? corrected.items[i] : undefined;
              if (!fromServer) return item;
              if (!item.engineStatus) {
                // 엔진이 모르는 항목 → 서버 판정을 쓰되 원문명은 유지한다.
                return { ...fromServer, originalName: item.originalName ?? item.name };
              }
              // 엔진이 판정한 항목 → 대표명만 갈아끼운다.
              const displayName = fromServer.name || item.name;
              return {
                ...item,
                name: displayName,
                originalName:
                  item.originalName ?? (displayName !== item.name ? item.name : undefined),
              };
            });
          }
          if (corrected?.summary) summary = corrected.summary;
          if (corrected?.questions?.length) questions = corrected.questions;
          if (corrected?.foods?.length) foods = corrected.foods;
          if (corrected?.testDate) resolvedTestDate = corrected.testDate;
          testSheetId = corrected?.testSheetId;
          week = corrected?.week;
        } catch (error) {
          // 서버 전송이 실패해도(로그인 만료, 서버 미기동 등) 프론트 OCR 결과로
          // 화면은 그대로 보여준다. 다만 판정은 검사지 인쇄 기준이라 임신 기준과
          // 다를 수 있다.
          console.warn("[scan] 검사지 서버 전송 실패:", error);
        }
      }

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
          testSheetId,
          week,
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
  text: { color: "#A0A0A0", fontFamily: "Pretendard-Medium", fontSize: 14, lineHeight: 22, textAlign: "center" },
  bars: { width: 100.8, gap: 4.8, alignItems: "flex-start" },
  bar: { height: 3.2, borderRadius: 220, backgroundColor: "#FA0C56" },
});
