import { BackChevronIcon, ChevronRightIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { MiniTrendLine } from "@/components/trend-chart";
import { DEMO_TREND_INDICATORS, loadLastReport, type LastReport } from "@/lib/report";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Figma(node 671:3093 분석): "분석" 탭의 실제 진입 화면 — 검사지에서 뽑힌
// 지표들을 한눈에 볼 수 있는 리스트. 행을 누르면 개별 추이 상세
// ([indicatorId].tsx, node 671:4538)로 이동한다. 실제 지표 추출 API가
// 붙기 전까지는 데모 데이터(lib/report.ts DEMO_TREND_INDICATORS)를 쓴다.
export default function Analysis() {
  const router = useRouter();
  const [report, setReport] = useState<LastReport | null>(null);
  const [checking, setChecking] = useState(true);
  const [query, setQuery] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadLastReport().then((value) => {
        if (active) {
          setReport(value);
          setChecking(false);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return DEMO_TREND_INDICATORS;
    return DEMO_TREND_INDICATORS.filter((item) => item.title.includes(q));
  }, [query]);

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

        {!checking && !report && (
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

        {report && (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => router.push("/(tabs)/analysis/report")} hitSlop={6}>
              <Text style={styles.dateHeading}>8월 15일</Text>
            </Pressable>

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
  dateHeading: { color: "#414141", fontFamily: "Pretendard-SemiBold", fontSize: 20, letterSpacing: -1 },

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
