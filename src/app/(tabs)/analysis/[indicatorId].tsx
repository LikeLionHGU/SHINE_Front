import { BackChevronIcon, CloseIcon, UpTriangleIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { TrendChart } from "@/components/trend-chart";
import { centeredContentStyle, MAX_CONTENT_WIDTH } from "@/lib/layout";
import { getTrend } from "@/lib/api";
import type { TrendIndicator } from "@/lib/report";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Figma(node 837:5500 분석_개별 상세 페이지): 선택한 지표의 추이 그래프 +
// 종합 추이 상세 설명. 지표는 서버(GET /api/v1/app/trends/{id})에서 받아온다.
// id는 검사 항목 코드 소문자다(hb, wbc, ferritin, vit_d, tsh).
export default function AnalysisDetail() {
  const router = useRouter();
  const { indicatorId } = useLocalSearchParams<{ indicatorId: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const [indicator, setIndicator] = useState<TrendIndicator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!indicatorId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getTrend(indicatorId).then((result) => {
      if (!active) return;
      setIndicator(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [indicatorId]);

  // 최근 두 검사 사이의 변화 방향으로 화살표를 결정한다.
  // 측정이 1회뿐이면 비교할 이전 값이 없어 위쪽으로 둔다.
  const history = indicator?.history ?? [];
  const trendingUp =
    history.length < 2 || history[history.length - 1].value >= history[history.length - 2].value;

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.push("/(tabs)/analysis");
  }

  if (!indicator) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <View style={styles.header}>
            <Pressable hitSlop={8} onPress={goBack}>
              <BackChevronIcon size={24} />
            </Pressable>
            <Text style={styles.headerTitle} pointerEvents="none">분석</Text>
            <Pressable hitSlop={8} onPress={() => router.push("/(tabs)/home")}>
              <CloseIcon size={24} />
            </Pressable>
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {loading ? "지표를 불러오는 중이에요" : "지표를 찾을 수 없어요"}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // 300으로 고정 상한을 두면 화면이 넓어져도(태블릿/웹) 차트가 그대로
  // 300px에 묶여 카드 안에서 작고 왼쪽에 치우쳐 보인다 — MAX_CONTENT_WIDTH
  // 기준으로 상한을 잡아서, 콘텐츠 폭이 커지는 만큼 차트도 같이 커지게 한다.
  const chartWidth = Math.min(windowWidth - 32 - 30 - 34, MAX_CONTENT_WIDTH - 32 - 30 - 34);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={goBack}>
            <BackChevronIcon size={24} />
          </Pressable>
          {/* 절대 위치라 헤더 전체를 덮는다 — pointerEvents를 꺼야 뒤로가기 버튼이 눌린다. */}
          <Text style={styles.headerTitle} pointerEvents="none">분석</Text>
          <Pressable hitSlop={8} onPress={() => router.push("/(tabs)/home")}>
            <CloseIcon size={24} />
          </Pressable>
        </View>

        <ScrollView style={centeredContentStyle} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <View style={{ transform: [{ rotate: trendingUp ? "0deg" : "180deg" }] }}>
              <UpTriangleIcon size={14} />
            </View>
            <Text style={styles.title}>{indicator.title}</Text>
            <StatusBadge status={indicator.status} />
          </View>

          <Text style={styles.definition}>{indicator.definition}</Text>

          <View style={styles.chartCard}>
            <TrendChart indicator={indicator} width={chartWidth} />
          </View>

          <Text style={styles.summaryHeading}>종합 추이 상세 설명</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{indicator.trendSummary}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 6 },
  headerTitle: { position: "absolute", left: 0, right: 0, textAlign: "center", color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 16 },

  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32, gap: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, color: "#414141", fontFamily: "Pretendard-SemiBold", fontSize: 20, letterSpacing: -1 },
  definition: { color: "#111", fontFamily: "Pretendard-Regular", fontSize: 12, lineHeight: 18 },

  chartCard: { backgroundColor: "#FFFCFD", borderRadius: 14, paddingVertical: 18, paddingHorizontal: 16 },

  summaryHeading: { color: "#414141", fontFamily: "Pretendard-SemiBold", fontSize: 18, letterSpacing: -1, marginTop: 4 },
  summaryCard: { backgroundColor: "#FFFCFD", borderRadius: 14, padding: 18 },
  summaryText: { color: "#111", fontFamily: "Pretendard-Regular", fontSize: 12, lineHeight: 18 },
});
