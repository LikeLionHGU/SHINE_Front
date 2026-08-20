import { BackChevronIcon, UpTriangleIcon } from "@/components/icons";
import { useScrollToTop } from "@/lib/use-scroll-top";
import { cardShadow, colors, font, headerBar, radius, tracking } from "@/lib/theme";
import { StatusBadge } from "@/components/status-badge";
import { chartWidthFor, TrendChart } from "@/components/trend-chart";
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
  // 화면에 들어올 때마다 스크롤을 맨 위로 되돌린다.
  const scrollRef = useScrollToTop();
  const router = useRouter();
  const { indicatorId } = useLocalSearchParams<{ indicatorId: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const [indicator, setIndicator] = useState<TrendIndicator | null>(null);
  const [loading, setLoading] = useState(true);
  // 항목 설명은 기본으로 펼쳐 두고, 제목 줄을 눌러 접을 수 있게 한다.
  const [definitionOpen, setDefinitionOpen] = useState(true);

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

  // 차트 폭은 카드 폭에서 구간 라벨 칸과 말풍선 자리를 뺀 나머지다
  // (시안 361 카드 → 그래프 277). 화면이 넓어져도(태블릿/웹) 카드가 커지는
  // 만큼 그래프도 같이 커지도록 MAX_CONTENT_WIDTH로 상한만 둔다.
  const cardWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH) - 32;
  const chartWidth = chartWidthFor(cardWidth);

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
        </View>

        <ScrollView ref={scrollRef} style={centeredContentStyle} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* 제목 줄을 누르면 항목 설명이 접혔다 펴진다.
              설명이 길어 차트를 아래로 밀어내는 경우가 있어 접을 수 있게 했다. */}
          <Pressable
            style={styles.titleRow}
            onPress={() => setDefinitionOpen((open) => !open)}
          >
            {/* 삼각형이 곧 접힘/펼침 표시다 — 접혀 있으면 아래(▼), 펴져 있으면 위(▲).
                오른쪽에 chevron을 하나 더 두면 같은 상태를 두 번 말하게 된다. */}
            <View style={{ transform: [{ rotate: definitionOpen ? "0deg" : "180deg" }] }}>
              <UpTriangleIcon size={14} />
            </View>
            <Text style={styles.title}>{indicator.title}</Text>
            <StatusBadge status={indicator.status} />
          </Pressable>

          {definitionOpen && (
            <Text style={styles.definition}>{indicator.definition}</Text>
          )}

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
header: { ...headerBar, justifyContent: "space-between", paddingHorizontal: 16 },
  headerTitle: { position: "absolute", left: 0, right: 0, textAlign: "center", color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 16 },

  // 시안 좌표(393 기준): 지표명 줄 top 156 · 차트 카드 212 · 설명 제목 465.
  content: { paddingHorizontal: 16, paddingTop: 64, paddingBottom: 32 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: {
    flex: 1,
    color: colors.textStrong,
    fontFamily: font.semiBold,
    fontSize: 20,
    letterSpacing: -1,
  },
  definition: {
    marginTop: 8,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: tracking(12),
  },

  // 시안 361x211. 그래프 위 41 / 아래 10, 왼쪽 9는 구간 라벨 자리,
  // 오른쪽 35는 마지막 점 위 말풍선이 카드를 넘지 않도록 비워둔 폭이다.
  chartCard: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingTop: 41,
    paddingBottom: 10,
    paddingLeft: 9,
    paddingRight: 35,
    ...cardShadow,
  },

  summaryHeading: {
    marginTop: 28,
    color: colors.textStrong,
    fontFamily: font.semiBold,
    fontSize: 18,
    letterSpacing: -1,
  },
  // 시안 361x106, 본문 폭 334 → 좌우 13.5
  summaryCard: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 13.5,
    ...cardShadow,
  },
  summaryText: {
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: tracking(12),
  },
});
