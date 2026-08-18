import {
  BackChevronIcon,
  ChevronRightIcon,
  CloseIcon,
  SparkleIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { centeredContentStyle, centeredSheetStyle } from "@/lib/layout";
import { getQuestionsBySheet, getRecordDetail } from "@/lib/api";
import {
  DEMO_SUMMARY,
  loadLastReport,
  type ParsedTestItem,
  type ReportFood,
} from "@/lib/report";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
  type ImageStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const DEMO_INGREDIENTS = ["달걀", "연어", "시금치", "표고버섯"];
const DEFAULT_QUESTIONS = ["Ex) 당 수치가 올라가고 있는데 괜찮나요?", "Ex) 비타민 D 수치가 떨어지고 있는데 괜찮나요?"];

// Figma(node 671:4356 검사지 분석-번역 / 671:4386, 837:5338 …단어 클릭시 하단
// 모달 등장): 업로드한 검사지 이미지("검사 결과칸")의 쉬운 번역본.
// scan/analyzing.tsx 단계에서 parseTestReport(lib/ocr.ts)가 검사항목/수치/상태
// 표를 읽고, generateReportInsights(lib/insights.ts)가 그 표를 바탕으로 종합
// 소견(summary)·추천 질문(questions)·추천 음식(foods)까지 만들어 함께 저장한다.
// "종합 분석" 카드는 summary + 표를 보여주고(둘 다 없으면 DEMO_SUMMARY로 대체),
// "질문 입력하기" 카드는 questions를(없으면 기본 예시 질문), "추천 재료" 카드는
// foods를(없으면 데모 재료) 보여준다. 표의 각 행을 누르면 하단 시트(837:5368
// 팝업3 — 제목+배지, 설명, 구분선, 판정)가 뜬다. 이미지 위에 항목별 마커는
// 두지 않는다 — OCR이 추정하는 위치가 부정확해서 실제 텍스트와 어긋나 보이는
// 문제가 있었다.
//
// "분석" 탭의 실제 진입점은 지표 리스트(analysis/index.tsx)이고, 이 화면은
// 검사지 업로드 직후(scan/analyzing.tsx → dismissTo)와 리스트 상단 날짜를
// 눌렀을 때, 그리고 기록 탭(record.tsx, from=record 파라미터와 함께)에서
// 도달하는 하위 화면이다.
/**
 * 이 화면이 실제로 그리는 것. 방금 올린 검사지는 로컬 사진(uri)이 있지만,
 * 기록 탭에서 연 지난 검사지는 서버 데이터라 사진이 없어 uri가 비어 있다.
 */
type ReportView = {
  uri?: string;
  items?: ParsedTestItem[];
  summary?: string;
  questions?: string[];
  foods?: ReportFood[];
  /** 서버에서 불러온 지난 검사지인지. 이때는 없는 값을 데모로 채우지 않는다. */
  fromServer?: boolean;
};

export default function AnalysisReport() {
  const router = useRouter();
  const { from, recordId } = useLocalSearchParams<{ from?: string; recordId?: string }>();
  const [report, setReport] = useState<ReportView | null>(null);
  const [checking, setChecking] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [question, setQuestion] = useState("");
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
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
      // recordId가 있으면 기록 탭에서 지난 검사지를 연 것이다. 그때는 로컬에
      // 남은 "마지막 리포트"가 아니라 그 검사지를 서버에서 불러와야 한다.
      // (로컬은 1건만 보관해서, 예전엔 어느 기록을 눌러도 마지막 것만 떴다.)
      const load: Promise<ReportView | null> = recordId
        ? Promise.all([getRecordDetail(recordId), getQuestionsBySheet(recordId)]).then(
            ([detail, questions]) =>
              detail
                ? {
                    items: detail.items,
                    summary: detail.summary,
                    // 그 검사지에 달린 추천 질문. 없으면 질문 카드가 안내 문구로 바뀐다.
                    questions: questions.map((q) => q.content),
                    fromServer: true,
                  }
                : null,
          )
        : loadLastReport();

      load.then((value) => {
        if (active) {
          setReport(value);
          setChecking(false);
        }
      });
      return () => {
        active = false;
      };
    }, [recordId]),
  );

  const activeItem = activeItemIndex != null ? (report?.items?.[activeItemIndex] ?? null) : null;
  // 이미지 위 마커 클릭과 종합 분석 표 행 클릭이 같은 하단 시트를 공유한다.
  // definition/verdict가 비어있으면(OCR이 못 채운 경우) 빈 시트 대신 안내
  // 문구를 대신 보여준다.
  const detail = activeItem
    ? {
        title: activeItem.name,
        originalName: activeItem.originalName,
        status: activeItem.status,
        definition: activeItem.definition || "이 항목에 대한 설명을 아직 준비하지 못했어요.",
        verdict: activeItem.verdict || `이번 수치(${activeItem.value || "정보 없음"})에 대한 자세한 설명을 아직 준비하지 못했어요.`,
      }
    : null;

  function closeDetail() {
    setActiveItemIndex(null);
  }

  function goBack() {
    // 기록 탭(record.tsx)에서 들어온 경우, 이 화면은 "분석" 탭 스택 위에
    // 새로 push된 것이라 router.back()이 분석 탭 안에서만 뒤로 가버린다
    // (기록 탭으로 못 돌아옴) — from=record일 때는 명시적으로 기록 탭으로
    // 돌려보낸다.
    if (from === "record") {
      router.replace("/(tabs)/record");
      return;
    }
    // 검사지 업로드 직후 도달하는 화면이라, 뒤로가기는 "산전 검사지를
    // 업로드 해주세요" 화면(scan/index.tsx)으로 돌려보낸다.
    // (헤더 X는 메인 홈으로 — 아래 header 참고)
    router.replace("/(modals)/scan");
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
          <Pressable hitSlop={8} onPress={() => router.replace("/(tabs)/home")}>
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
          <ScrollView style={centeredContentStyle} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {/* 이미지 위 마커는 OCR이 추정한 위치가 부정확해서(항목 텍스트와
                안 맞는 곳에 찍힘) 뺐다 — 항목 상세는 아래 종합 분석 표의
                행을 눌러서만 연다. */}
            {report.uri && (
              <>
                <Text style={styles.sectionTitle}>검사 결과칸</Text>
                <View style={[styles.imageWrap, { aspectRatio: imageAspect }]}>
                  <Image source={{ uri: report.uri }} style={[styles.image, styles.scanFilter]} resizeMode="contain" />
                </View>
                <Text style={styles.zoomHint}>*두 손가락으로 확대/축소를 해보세요</Text>
              </>
            )}

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
                    <>
                      {/* generateReportInsights(lib/insights.ts)가 검사항목을 바탕으로
                          작성한 종합 소견. 생성 전이거나 실패했으면 데모 문구로 대체한다. */}
                      <Text style={styles.summaryText}>
                        {report.summary ||
                          (report.fromServer
                            ? "이 검사지에는 아직 종합 소견이 저장되지 않았어요."
                            : DEMO_SUMMARY)}
                      </Text>
                      <View style={styles.table}>
                        <View style={styles.tableHeaderRow}>
                          <Text style={[styles.tableHeaderCell, styles.colName]}>검사항목</Text>
                          <Text style={[styles.tableHeaderCell, styles.colValue]}>수치</Text>
                          <Text style={[styles.tableHeaderCell, styles.colStatus]}>상태</Text>
                        </View>
                        {report.items.map((item, i) => (
                          <Pressable
                            key={`${item.name}-${i}`}
                            style={({ pressed }) => [
                              styles.tableRow,
                              i === report.items!.length - 1 && styles.tableRowLast,
                              pressed && styles.pressed,
                            ]}
                            onPress={() => setActiveItemIndex(i)}
                          >
                            <View style={styles.colName}>
                              <Text style={styles.tableCell} numberOfLines={2}>
                                {item.name}
                              </Text>
                              {/* 검사지에 인쇄된 원문 항목명. 종이와 대조할 수 있게 같이 보여준다. */}
                              {item.originalName && (
                                <Text style={styles.tableCellOriginal} numberOfLines={1}>
                                  {item.originalName}
                                </Text>
                              )}
                            </View>
                            <Text style={[styles.tableCell, styles.colValue]} numberOfLines={2}>
                              {item.value || "-"}
                            </Text>
                            <View style={styles.colStatus}>
                              <StatusBadge status={item.status} />
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={styles.summaryText}>
                      {report.fromServer ? "검사 항목을 불러오지 못했어요." : DEMO_SUMMARY}
                    </Text>
                  )}
                </>
              )}
            </View>

            <View style={styles.questionCard}>
              <Text style={styles.cardTitle}>다음 진료 추천 질문</Text>
              {report.questions && report.questions.length > 0 ? (
                report.questions.map((q, i) => (
                  <View key={i} style={styles.exampleRow}>
                    <SparkleIcon />
                    <Text style={styles.example}>{q}</Text>
                  </View>
                ))
              ) : report.fromServer ? (
                <Text style={styles.cardHint}>이 검사지에 저장된 추천 질문이 없어요.</Text>
              ) : (
                DEFAULT_QUESTIONS.map((q, i) => (
                  <View key={i} style={styles.exampleRow}>
                    <SparkleIcon />
                    <Text style={styles.example}>{q}</Text>
                  </View>
                ))
              )}
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
                report.foods?.length || !report.fromServer ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ingredients}>
                    {(report.foods && report.foods.length > 0
                      ? report.foods
                      : DEMO_INGREDIENTS.map((name) => ({ name, reason: "" }))
                    ).map((food) => (
                      <View key={food.name} style={styles.ingredient}>
                        <Text style={styles.ingredientName}>{food.name}</Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.cardHint}>이 검사지에 저장된 추천 재료가 없어요.</Text>
                )
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal
        transparent
        visible={!!detail}
        animationType="slide"
        onRequestClose={closeDetail}
      >
        {/* backdrop을 화면 전체에 절대 배치해서 시트 뒤쪽(둥근 모서리로 잘려나가는
            부분 포함)까지 덮도록 한다. 예전엔 backdrop이 시트 위쪽 공간만
            차지해서, 시트의 둥근 위쪽 모서리 바깥으로 배경(그라데이션 핑크)이
            그대로 비쳐 보이는 문제가 있었다. */}
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeDetail} />
          {detail && (
            <View style={styles.sheet}>
              <Pressable hitSlop={8} style={styles.sheetClose} onPress={closeDetail}>
                <CloseIcon size={16} />
              </Pressable>
              <View style={styles.sheetTitleRow}>
                <Text style={styles.sheetTitle}>{detail.title}</Text>
                {detail.originalName && (
                  <Text style={styles.sheetTitleOriginal}>{detail.originalName}</Text>
                )}
                <StatusBadge status={detail.status} />
              </View>
              <Text style={styles.sheetDefinition}>{detail.definition}</Text>
              <View style={styles.sheetDivider} />
              <Text style={styles.sheetVerdict}>{detail.verdict}</Text>
            </View>
          )}
        </View>
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

  sectionTitle: { paddingHorizontal: 2, color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 16 },
  // aspectRatio는 렌더링 시 실제 업로드 사진 비율로 덮어쓴다(기본값은 초기 로딩 중 fallback).
  imageWrap: { alignSelf: "center", width: "79%", borderRadius: 8, overflow: "visible" },
  image: { width: "100%", height: "100%", borderRadius: 8, backgroundColor: "#FFF0F6" },
  // scanDocumentImage(lib/scan.ts)가 정리해준 사진을 "스캔한 문서"처럼
  // 흑백·고대비 톤으로 보여준다. 실제 픽셀은 원본 그대로 둔다.
  // filter는 웹에서만 동작하고 RN 타입에는 없어서 캐스팅해서 넘긴다.
  scanFilter: {
    filter: [{ grayscale: 1 }, { contrast: 1.6 }, { brightness: 1.05 }],
  } as unknown as ImageStyle,
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
  colName: { flex: 1.15, paddingRight: 6 },
  tableCellOriginal: { marginTop: 1, color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 11, lineHeight: 15 },
  cardHint: { paddingVertical: 8, paddingBottom: 14, color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 13, lineHeight: 20 },
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

  // justifyContent: "flex-end"이라 시트(유일한 in-flow 자식)는 항상 하단에
  // 붙고, backdrop은 absoluteFill이라 시트 뒤(둥근 모서리 바깥 포함) 화면
  // 전체를 덮는다.
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)" },
  sheet: {
    ...centeredSheetStyle,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // 그림자가 둥근 모서리를 벗어나 각진 사각형으로 비치는 걸 막는다(특히
    // 웹 렌더러에서 shadow*와 borderRadius를 같이 쓰면 그림자가 모서리
    // 곡선을 따라 잘리지 않고 사각형 그대로 보이는 경우가 있다).
    overflow: "hidden",
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
  sheetTitleOriginal: { flex: 1, color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 12 },
  sheetDefinition: { color: "#111", fontFamily: "Pretendard-Regular", fontSize: 12, lineHeight: 18 },
  sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "#E5E5E5" },
  sheetVerdict: { color: "#111", fontFamily: "Pretendard-Regular", fontSize: 12, lineHeight: 18 },
});
