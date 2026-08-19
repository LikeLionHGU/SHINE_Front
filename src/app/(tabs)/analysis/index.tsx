import { BackChevronIcon, ChevronRightIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { MiniTrendLine } from "@/components/trend-chart";
import { centeredContentStyle } from "@/lib/layout";
import { getTrends } from "@/lib/api";
import type { TrendIndicator } from "@/lib/report";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Figma(node 837:4354 분석): "분석" 탭의 실제 진입 화면 — 검사지에서 뽑힌
// 지표들을 한눈에 볼 수 있는 리스트. 지표는 서버(GET /api/v1/app/trends)에서
// 받아온다 — 꺾은선을 그릴 수 있는 정량 항목만 오고, 각 지표의 history가
// 지금까지 올린 검사지의 날짜별 값이다. 상단 날짜 옆 화살표로 지난 검사
// 날짜를 오갈 수 있다(라벨 이동). 행을 누르면 개별 추이 상세
// ([indicatorId].tsx, node 837:5500)로 이동한다.
export default function Analysis() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [query, setQuery] = useState("");
  const [indicators, setIndicators] = useState<TrendIndicator[]>([]);
  const [dateIndex, setDateIndex] = useState(0);

  // 모든 지표가 같은 검사일들을 x축으로 공유하므로, 가장 많은 점을 가진
  // 지표의 날짜 목록을 상단 날짜 네비게이션의 기준으로 쓴다.
  const dateLabels = useMemo(() => {
    const longest = indicators.reduce<TrendIndicator | null>(
      (best, item) => (!best || item.history.length > best.history.length ? item : best),
      null,
    );
    return longest?.history.map((point) => point.date) ?? [];
  }, [indicators]);

  const safeDateIndex = Math.min(dateIndex, Math.max(0, dateLabels.length - 1));
  const canGoPrevDate = safeDateIndex > 0;
  const canGoNextDate = safeDateIndex < dateLabels.length - 1;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // 빈 상태 판단 기준은 "이 기기에서 올린 검사지"가 아니라 서버에 쌓인 지표다.
      // 로컬 리포트로 막아두면 기기를 바꾸거나 앱을 다시 깔았을 때, 서버에
      // 검사지가 있는데도 분석 탭이 빈 화면으로 뜬다.
      getTrends().then((result) => {
        if (!active) return;
        setIndicators(result);
        // 최신 검사일이 배열의 끝이라 기본 선택값은 마지막 항목이다.
        //
        // 날짜 목록(dateLabels)은 history가 가장 긴 지표를 기준으로 만드는데,
        // 여기서 첫 번째 지표의 길이를 쓰면 지표마다 측정 횟수가 다를 때
        // (어떤 항목은 매번, 어떤 항목은 한 번만 검사) 최신이 아닌 중간 날짜가
        // 선택된 채로 열린다. 같은 기준(가장 긴 history)으로 맞춘다.
        const longest = result.reduce(
          (max, item) => Math.max(max, item.history.length),
          0,
        );
        setDateIndex(Math.max(0, longest - 1));
        setChecking(false);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return indicators;
    return indicators.filter((item) => item.title.includes(q));
  }, [indicators, query]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.push("/(tabs)/home");
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={goBack}>
            <BackChevronIcon size={24} />
          </Pressable>
          <Text style={styles.headerTitle} pointerEvents="none">분석</Text>
          <View style={{ width: 24 }} />
        </View>

        {!checking && indicators.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>아직 분석된 검사지가 없어요</Text>
            <Text style={styles.emptyBody}>검사지를 업로드하면 지표별 추이를 볼 수 있어요.</Text>
            <Pressable
              style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
              onPress={() => router.push("/(modals)/scan")}
            >
              <Text style={styles.emptyButtonText}>검사지 업로드하기</Text>
            </Pressable>
          </View>
        )}

        {indicators.length > 0 && (
          <ScrollView style={centeredContentStyle} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.dateNav}>
              <Pressable
                hitSlop={8}
                disabled={!canGoPrevDate}
                onPress={() => setDateIndex((i) => Math.max(0, i - 1))}
              >
                <BackChevronIcon size={24} color={canGoPrevDate ? "#414141" : "#D8D8D8"} />
              </Pressable>
              <Pressable onPress={() => router.push("/(tabs)/analysis/report")} hitSlop={6}>
                <Text style={styles.dateHeading}>{dateLabels[safeDateIndex] ?? ""}</Text>
              </Pressable>
              <Pressable
                hitSlop={8}
                disabled={!canGoNextDate}
                onPress={() => setDateIndex((i) => Math.min(dateLabels.length - 1, i + 1))}
              >
                <View style={{ transform: [{ rotate: "180deg" }] }}>
                  <BackChevronIcon size={24} color={canGoNextDate ? "#414141" : "#D8D8D8"} />
                </View>
              </Pressable>
            </View>

            <View style={styles.searchWrap}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="찾고 싶은 항목을 입력해주세요"
                placeholderTextColor="#A0A0A0"
                style={styles.searchInput}
                returnKeyType="search"
              />
              <SearchIcon />
            </View>

            <View style={styles.card}>
              {filtered.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.row,
                    index < filtered.length - 1 && styles.rowDivider,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => router.push(`/(tabs)/analysis/${item.id}`)}
                >
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.rowRight}>
                    <MiniTrendLine values={item.history.map((h) => h.value)} />
                    <StatusBadge status={item.status} />
                    <ChevronRightIcon size={20} />
                  </View>
                </Pressable>
              ))}
              {filtered.length === 0 && (
                <View style={styles.noResult}>
                  <Text style={styles.noResultText}>검색 결과가 없어요</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function SearchIcon() {
  return (
    <View style={styles.searchIcon}>
      <View style={styles.searchIconCircle} />
      <View style={styles.searchIconHandle} />
    </View>
  );
}

const shadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.06,
  shadowRadius: 3,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 6 },
  headerTitle: { position: "absolute", left: 0, right: 0, textAlign: "center", color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16 },
  pressed: { opacity: 0.78 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 },
  emptyTitle: { color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 18 },
  emptyBody: { color: "#707070", fontFamily: "Pretendard-Regular", fontSize: 14, textAlign: "center" },
  emptyButton: { marginTop: 12, height: 46, paddingHorizontal: 24, borderRadius: 12, backgroundColor: "#FA0C56", alignItems: "center", justifyContent: "center" },
  emptyButtonText: { color: "#FFFDF9", fontFamily: "Pretendard-SemiBold", fontSize: 16 },

  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, gap: 12 },
  dateNav: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  dateHeading: { color: "#414141", fontFamily: "Pretendard-SemiBold", fontSize: 20, letterSpacing: -1, textAlign: "center", minWidth: 79 },

  searchWrap: {
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFCFD",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    ...shadow,
  },
  searchInput: { flex: 1, height: "100%", color: "#111", fontFamily: "Pretendard-Regular", fontSize: 14 },
  searchIcon: { width: 16, height: 16, alignItems: "center", justifyContent: "center" },
  searchIconCircle: { width: 11, height: 11, borderRadius: 6, borderWidth: 1.4, borderColor: "#A0A0A0", position: "absolute", top: 0, left: 0 },
  searchIconHandle: { width: 5, height: 1.4, backgroundColor: "#A0A0A0", position: "absolute", bottom: 0, right: 0, transform: [{ rotate: "45deg" }] },

  card: { borderRadius: 14, backgroundColor: "#FFFCFD", paddingHorizontal: 18, ...shadow },
  row: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5E5" },
  rowTitle: { flex: 1, color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  noResult: { paddingVertical: 24, alignItems: "center" },
  noResultText: { color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 14 },
});
