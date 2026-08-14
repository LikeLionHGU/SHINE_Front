import {
  BackChevronIcon,
  ChevronRightIcon,
  CloseIcon,
  SparkleIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import {
  DEMO_INDICATORS,
  DEMO_SUMMARY,
  loadLastReport,
  type LastReport,
} from "@/lib/report";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const INGREDIENTS = ["달걀", "연어", "시금치", "버섯"];

// Figma(node 671:4356 검사지 분석-번역 / 671:4386 …단어 클릭시 하단 모달 등장):
// 업로드한 검사지 이미지의 쉬운 번역본. "종합 분석" 카드는 scan/analyzing.tsx
// 단계에서 parseTestReport(lib/ocr.ts)가 실제로 읽어낸 검사항목/수치/상태
// 표를 보여준다(파싱 결과가 없으면 DEMO_SUMMARY로 대체). 이미지 위 마커를
// 누르면 지표 상세가 하단 시트로 뜨는데(671:4531 안심/주의/위험 배지),
// 마커 자체는 아직 데모 데이터(lib/report.ts DEMO_INDICATORS)를 사용한다.
//
// "분석" 탭의 실제 진입점은 지표 리스트(analysis/index.tsx)이고, 이 화면은
// 검사지 업로드 직후(scan/analyzing.tsx → dismissTo)와 리스트 상단 날짜를
// 눌렀을 때 도달하는 하위 화면이다.
export default function AnalysisReport() {
  const router = useRouter();
  const [report, setReport] = useState<LastReport | null>(null);
  const [checking, setChecking] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [question, setQuestion] = useState("");
  const [activeIndicatorId, setActiveIndicatorId] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState(310.088 / 509);

  // 업로드한 사진의 실제 가로세로 비율대로 보여준다(고정 목업 비율로
  // 잘리지 않도록). scanDocumentImage(lib/scan.ts)는 리사이즈를 하지 않으므로
  // 여기서 읽는 크기가 곧 사용자가 넣은 사진 원본 크기다.
  useEffect(() => {
    if (!report?.uri) return;
    Image.getSize(
      report.uri,
      (width, height) => {
        if (width > 0 && height > 0) setImageAspect(width / height);
      },
      () => {},
    );
  }, [report?.uri]);

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

  const indicator = activeIndicatorId ? DEMO_INDICATORS[activeIndicatorId] : null;

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.push("/(tabs)/analysis");
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
          <Pressable hitSlop={8} onPress={() => router.push("/(tabs)/home")}>
            <CloseIcon size={24} />
          </Pressable>
        </View>

        {!checking && !report && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>아직 분석된 검사지가 없어요</Text>
            <Text style={styles.emptyBody}>검사지를 업로드하면 쉬운 번역본을 볼 수 있어요.</Text>
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
            <View style={[styles.imageWrap, { aspectRatio: imageAspect }]}>
              <Image source={{ uri: report.uri }} style={[styles.image, styles.scanFilter]} resizeMode="cover" />
              {Object.values(DEMO_INDICATORS).map((item) => (
                <Pressable
                  key={item.id}
                  hitSlop={10}
                  style={[
                    styles.marker,
                    { left: `${item.markerPosition.xRatio * 100}%`, top: `${item.markerPosition.yRatio * 100}%` },
                  ]}
                  onPress={() => setActiveIndicatorId(item.id)}
                >
                  <View style={styles.markerDot} />
                </Pressable>
              ))}
            </View>
            <Text style={styles.zoomHint}>*두 손가락으로 확대/축소를 해보세요</Text>

            <View style={styles.card}>
              <Pressable style={styles.cardHeader} onPress={() => setSummaryOpen((v) => !v)}>
                <Text style={styles.cardTitle}>종합 분석</Text>
                <View style={{ transform: [{ rotate: summaryOpen ? "90deg" : "0deg" }] }}>
                  <ChevronRightIcon size={20} />
                </View>
              </Pressable>
              {summaryOpen && (
                <>
                  {report.items && report.items.length > 0 ? (
                    <View style={styles.table}>
                      <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, styles.colName]}>검사항목</Text>
                        <Text style={[styles.tableHeaderCell, styles.colValue]}>수치</Text>
                        <Text style={[styles.tableHeaderCell, styles.colStatus]}>상태</Text>
                      </View>
                      {report.items.map((item, i) => (
                        <View
                          key={`${item.name}-${i}`}
                          style={[styles.tableRow, i === report.items!.length - 1 && styles.tableRowLast]}
                        >
                          <Text style={[styles.tableCell, styles.colName]} numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text style={[styles.tableCell, styles.colValue]} numberOfLines={2}>
                            {item.value || "-"}
                          </Text>
                          <View style={styles.colStatus}>
                            <StatusBadge status={item.status} />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.summaryText}>{DEMO_SUMMARY}</Text>
                  )}
                </>
              )}
            </View>

            <View style={styles.questionCard}>
              <View style={styles.exampleRow}><SparkleIcon /><Text style={styles.example}>Ex) 당 수치가 올라가고 있는데 괜찮나요?</Text></View>
              <View style={styles.exampleRow}><SparkleIcon /><Text style={styles.example}>Ex) 비타민 D 수치가 떨어지고 있는데 괜찮나요?</Text></View>
              <View style={styles.inputWrap}>
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="질문 입력하기"
                  placeholderTextColor="#A0A0A0"
                  style={styles.input}
                  returnKeyType="send"
                />
              </View>
            </View>

            <View style={styles.card}>
              <Pressable style={styles.cardHeader} onPress={() => setIngredientsOpen((v) => !v)}>
                <Text style={styles.cardTitle}>추천 재료</Text>
                <View style={{ transform: [{ rotate: ingredientsOpen ? "90deg" : "0deg" }] }}>
                  <ChevronRightIcon size={20} />
                </View>
              </Pressable>
              {ingredientsOpen && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ingredients}>
                  {INGREDIENTS.map((name) => (
                    <View key={name} style={styles.ingredient}>
                      <Text style={styles.ingredientName}>{name}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        transparent
        visible={!!indicator}
        animationType="slide"
        onRequestClose={() => setActiveIndicatorId(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActiveIndicatorId(null)} />
        {indicator && (
          <View style={styles.sheet}>
            <Pressable hitSlop={8} style={styles.sheetClose} onPress={() => setActiveIndicatorId(null)}>
              <CloseIcon size={16} />
            </Pressable>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>{indicator.title}</Text>
              <StatusBadge status={indicator.status} />
            </View>
            <Text style={styles.sheetDefinition}>{indicator.definition}</Text>
            <View style={styles.sheetDivider} />
            <Text style={styles.sheetVerdict}>{indicator.verdict}</Text>
          </View>
        )}
      </Modal>
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
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 12 },
  pressed: { opacity: 0.78 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 },
  emptyTitle: { color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 18 },
  emptyBody: { color: "#707070", fontFamily: "Pretendard-Regular", fontSize: 14, textAlign: "center" },
  emptyButton: { marginTop: 12, height: 46, paddingHorizontal: 24, borderRadius: 12, backgroundColor: "#FA0C56", alignItems: "center", justifyContent: "center" },
  emptyButtonText: { color: "#FFFDF9", fontFamily: "Pretendard-SemiBold", fontSize: 16 },

  // aspectRatio는 렌더링 시 실제 업로드 사진 비율로 덮어쓴다(기본값은 초기 로딩 중 fallback).
  imageWrap: { alignSelf: "center", width: "79%", borderRadius: 8, overflow: "visible" },
  image: { width: "100%", height: "100%", borderRadius: 8, backgroundColor: "#FFF0F6" },
  // scanDocumentImage(lib/scan.ts)가 정리해준 사진을 "스캔한 문서"처럼
  // 흑백·고대비 톤으로 보여준다. 실제 픽셀은 원본 그대로 두고, 화면에
  // 그릴 때만 필터를 얹는 방식이라 지표 마커 좌표 계산에는 영향이 없다.
  scanFilter: { filter: [{ grayscale: 1 }, { contrast: 1.6 }, { brightness: 1.05 }] },
  marker: { position: "absolute", width: 22, height: 22, marginLeft: -11, marginTop: -11, alignItems: "center", justifyContent: "center" },
  markerDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#FA0C5680", borderWidth: 2, borderColor: "#FA0C56" },
  zoomHint: { alignSelf: "center", color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 12, marginTop: -4 },

  card: { paddingTop: 11, paddingHorizontal: 18, paddingBottom: 4, borderRadius: 14, backgroundColor: "#FFFCFD", gap: 8, ...shadow },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 24 },
  cardTitle: { color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 16 },
  summaryText: { color: "#111", fontFamily: "Pretendard-Regular", fontSize: 14, lineHeight: 20, paddingBottom: 14 },

  // parseTestReport(lib/ocr.ts)가 읽어낸 검사항목/수치/상태 표.
  table: { paddingBottom: 12 },
  tableHeaderRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#EFEFEF" },
  tableHeaderCell: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 12 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EFEFEF",
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableCell: { color: "#111", fontFamily: "Pretendard-Regular", fontSize: 13, lineHeight: 18, paddingRight: 6 },
  colName: { flex: 1.15 },
  colValue: { flex: 0.95 },
  colStatus: { width: 56, alignItems: "flex-start" },

  questionCard: { paddingHorizontal: 18, paddingTop: 11, paddingBottom: 14, borderRadius: 14, backgroundColor: "#FFFCFD", gap: 8, ...shadow },
  exampleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  example: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 14 },
  inputWrap: { height: 41, borderRadius: 8, justifyContent: "center", backgroundColor: "#FFF0F6" },
  input: { height: "100%", paddingHorizontal: 15, color: "#111", fontFamily: "Pretendard-Medium", fontSize: 14 },

  ingredients: { paddingBottom: 12, gap: 8 },
  ingredient: { width: 67, height: 76, borderRadius: 4, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8, backgroundColor: "#FFF0F6" },
  ingredientName: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 12 },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#CFCFCF",
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  sheetClose: { position: "absolute", right: 20, top: 16 },
  sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sheetTitle: { color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16 },
  sheetDefinition: { color: "#111", fontFamily: "Pretendard-Regular", fontSize: 12, lineHeight: 18 },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E5E5E5" },
  sheetVerdict: { color: "#111", fontFamily: "Pretendard-Regular", fontSize: 12, lineHeight: 18 },
});
