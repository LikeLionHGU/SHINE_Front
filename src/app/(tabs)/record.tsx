import { ChevronRightIcon, XXLogoIcon } from "@/components/icons";
import { headerBar } from "@/lib/theme";
import { centeredContentStyle } from "@/lib/layout";
import { getRecords } from "@/lib/api";
import type { RecordEntry } from "@/lib/report";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Figma(node 837:4436 기록): 지금까지 업로드한 검사지들의 타임라인.
// 항목을 누르면 그날의 "쉬운 번역본"으로 이동한다.
// 목록은 서버(GET /api/v1/app/records)에서 받아온다 — 서버가 없거나 요청이
// 실패하면 @/lib/api가 데모 데이터로 되돌린다.
export default function Record() {
  const router = useRouter();
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getRecords().then((result) => {
        if (!active) return;
        setRecords(result);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          {/* 기록은 탭 최상위 화면이라 뒤로가기를 두지 않는다 — 양쪽 여백만 맞춘다. */}
          <View style={{ width: 24, height: 24 }} />
          <Text style={styles.headerTitle} pointerEvents="none">
            기록
          </Text>
          <View style={{ width: 24, height: 24 }} />
        </View>

        <ScrollView style={centeredContentStyle} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <XXLogoIcon />
          <Text style={styles.heading}>차곡차곡 쌓인{"\n"}나의 건강 기록</Text>

          <View style={styles.timeline}>
            {records.map((record, index) => (
              <View key={record.id}>
                {index !== 0 && <View style={styles.connector} />}
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={() =>
                    // from=record를 같이 넘겨서, report.tsx의 뒤로가기가 분석 탭
                    // 안으로 파고들지 않고 이 기록 화면으로 되돌아오게 한다.
                    // recordId를 같이 넘겨야 report.tsx가 "마지막에 올린 검사지"가
                    // 아니라 방금 누른 그 검사지를 서버에서 불러온다.
                    router.push({
                      pathname: "/(tabs)/analysis/report",
                      params: { from: "record", recordId: record.id },
                    })
                  }
                >
                  <View style={styles.dateCol}>
                    <View style={styles.dot} />
                    <Text style={styles.dateText}>{record.date}</Text>
                    <Text style={styles.weekText}>{record.week}</Text>
                  </View>
                  <View style={[styles.card, index === 0 && styles.cardFeatured]}>
                    <Text style={styles.cardText} numberOfLines={2}>
                      {record.summary}
                    </Text>
                    <ChevronRightIcon size={20} />
                  </View>
                </Pressable>
              </View>
            ))}
            {!loading && records.length === 0 && (
              <Text style={styles.emptyText}>아직 업로드한 검사지가 없어요.</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
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
header: { ...headerBar, justifyContent: "space-between", paddingHorizontal: 16 },
  headerTitle: { position: "absolute", left: 0, right: 0, textAlign: "center", color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16 },
  pressed: { opacity: 0.78 },

  content: { paddingHorizontal: 15, paddingTop: 24, paddingBottom: 32 },
  heading: { color: "#4C4C4C", fontFamily: "Pretendard-SemiBold", fontSize: 24, lineHeight: 32, letterSpacing: -0.72, marginTop: 12, marginBottom: 24 },

  timeline: { gap: 0 },
  connector: { width: 1, height: 20, backgroundColor: "#E9C9D3", marginLeft: 3.5 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  dateCol: { width: 64, alignItems: "center", gap: 4, paddingTop: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FA0C56" },
  dateText: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 14 },
  weekText: { color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 12 },

  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 68,
    borderRadius: 10,
    backgroundColor: "#FFFCFD",
    paddingVertical: 14,
    paddingHorizontal: 16,
    ...shadow,
  },
  cardFeatured: { backgroundColor: "#FFFFFF" },
  emptyText: { paddingVertical: 32, textAlign: "center", color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 14 },
  cardText: { flex: 1, color: "#111", fontFamily: "Pretendard-Regular", fontSize: 14, lineHeight: 20, letterSpacing: -0.42 },
});
