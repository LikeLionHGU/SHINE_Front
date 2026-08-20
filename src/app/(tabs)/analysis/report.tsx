import { FoodImage } from "@/components/food-image";
import {
  AiQuestionIcon,
  BackChevronIcon,
  ChevronRightIcon,
  CloseIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import {
  createQuestion,
  getQuestionsBySheet,
  getRecordDetail,
  submitReport,
  uploadTestSheetImage,
} from "@/lib/api";
import { generateReportInsights } from "@/lib/insights";
import {
  buildEngineQuestions,
  buildEngineSummary,
  reanalyzeItems,
} from "@/lib/labs/bridge";
import { centeredContentStyle, centeredSheetStyle } from "@/lib/layout";
import { currentPregnancyWeek } from "@/lib/pregnancy";
import {
  DEMO_SUMMARY,
  loadLastReport,
  loadReportEdits,
  reportSignature,
  saveLastReport,
  saveReportEdits,
  type IndicatorStatus,
  type ParsedTestItem,
  type ReportFood,
} from "@/lib/report";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Linking,
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
const DEFAULT_QUESTIONS = [
  "Ex) 당 수치가 올라가고 있는데 괜찮나요?",
  "Ex) 비타민 D 수치가 떨어지고 있는데 괜찮나요?",
];

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
  /** 여러 항목을 함께 봐야 나오는 소견 (판정 엔진 lib/labs가 만든다). */
  crossFindings?: {
    name: string;
    message: string;
    status: IndicatorStatus;
    conditions: string[];
  }[];
  /** 판정 엔진이 아직 모르는 항목. 조용히 빼지 않고 밝혀서 보여준다. */
  unsupported?: { name: string; value: string }[];
  /** 화면 하단 출처 표기. */
  sources?: { label: string; url: string; badge: string }[];
  /** 판정에 쓴 임신 주차. 엔진이 만드는 종합 소견 문장에 쓴다. */
  gestationalWeek?: number;
  /** 검사지에 인쇄된 검사일("26.08.20"). 서버 저장 때 함께 보낸다. */
  testDate?: string;
  /** 서버가 발급한 검사지 id. 있으면 이미 저장된 검사지다. */
  testSheetId?: number;
  /** 서버가 계산한 검사 당시 임신 주차 스냅샷. */
  week?: string;
  /** 서버에서 불러온 지난 검사지인지. 이때는 없는 값을 데모로 채우지 않는다. */
  fromServer?: boolean;
};

export default function AnalysisReport() {
  const router = useRouter();
  const { from, recordId } = useLocalSearchParams<{
    from?: string;
    recordId?: string;
  }>();
  const [report, setReport] = useState<ReportView | null>(null);
  const [checking, setChecking] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [question, setQuestion] = useState("");
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [questionNotice, setQuestionNotice] = useState<string | null>(null);
  // AI가 추천 질문을 만드는 중인지. 만드는 동안 카드가 비어 보이지 않게 한다.
  const [generatingInsights, setGeneratingInsights] = useState(false);
  // AI 질문 생성이 왜 실패했는지. 개발 중에만 화면에 띄워 원인을 바로 본다.
  const [insightsError, setInsightsError] = useState<string | null>(null);
  // 서버 저장(POST /reports)은 사용자가 "저장하기"를 누를 때만 한다.
  const [savingToServer, setSavingToServer] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  // 서버에 저장한 뒤 값을 고쳤는지. 고쳤으면 다시 저장할 수 있게 버튼을 되살린다.
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  // OCR이 잘못 읽었을 때 사용자가 직접 고치는 흐름. 고치면 그 자리에서 다시 판정한다.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
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

  // 기록 탭에서 연 검사지는 recordId로, 방금 올린 검사지는 "last"로 구분해 저장한다.
  const editsKey = recordId ?? "last";

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // recordId가 있으면 기록 탭에서 지난 검사지를 연 것이다. 그때는 로컬에
      // 남은 "마지막 리포트"가 아니라 그 검사지를 서버에서 불러와야 한다.
      // (로컬은 1건만 보관해서, 예전엔 어느 기록을 눌러도 마지막 것만 떴다.)
      const load: Promise<ReportView | null> = recordId
        ? Promise.all([
            getRecordDetail(recordId),
            getQuestionsBySheet(recordId),
          ]).then(([detail, questions]) =>
            detail
              ? {
                  items: detail.items,
                  summary: detail.summary,
                  // 그 검사지에 달린 추천 질문. /questions가 비면 검사지 응답에
                  // 같이 담겨 오는 questions를 쓴다. 둘 다 없으면 안내 문구.
                  questions:
                    questions.length > 0
                      ? questions.map((q) => q.content)
                      : (detail.questions ?? []),
                  // 저장할 때 함께 보낸 추천 재료. 서버가 돌려주면 그대로 보여준다.
                  foods: detail.foods ?? [],
                  fromServer: true,
                }
              : null,
          )
        : loadLastReport();

      load
        .then(async (value) => {
          if (!value?.items?.length) return value;
          // 서버에서 불러온 지난 검사지에는 판정 근거가 붙어 있지 않다. 값 문자열에
          // 참고범위가 같이 들어 있는 경우가 많아서("3.79 % (33~44)"), 그걸 되살려
          // 판정 엔진을 한 번 더 태운다. 그래야 기록 탭에서 연 검사지에도 기준·출처가
          // 붙고, 자릿수 오독(Hct 3.79%)도 같은 방식으로 걸러진다.
          const alreadyJudged = value.items.some((item) => !!item.engineStatus);
          if (alreadyJudged) return value;
          try {
            const gestationalWeek = await currentPregnancyWeek();
            const re = reanalyzeItems(value.items, { gestationalWeek });
            return {
              ...value,
              gestationalWeek,
              items: re.items,
              crossFindings: value.crossFindings ?? re.crossFindings,
              unsupported: value.unsupported ?? re.unsupported,
              sources: value.sources ?? re.sources,
            };
          } catch {
            // 재판정에 실패해도 서버가 준 값 그대로 보여준다.
            return value;
          }
        })
        // 사용자가 직접 고친 값이 있으면 원본 위에 덧씌운다.
        // 이 단계가 없으면 화면에 들어올 때마다 원본이 수정을 덮어써서,
        // "고쳐도 새로고침하면 원래대로 돌아온다"가 된다.
        .then(async (value) => {
          if (!value) return value;
          try {
            const edits = await loadReportEdits(editsKey);
            if (!edits) return value;
            // 원본이 바뀌었으면(새 검사지를 올렸으면) 옛 수정분은 버린다.
            if (edits.signature !== reportSignature(value.items)) return value;
            return {
              ...value,
              items: edits.items,
              summary: edits.summary ?? value.summary,
              questions: edits.questions ?? value.questions,
              foods: edits.foods ?? value.foods,
              crossFindings: edits.crossFindings ?? value.crossFindings,
              unsupported: edits.unsupported ?? value.unsupported,
              sources: edits.sources ?? value.sources,
              fromServer: false,
            };
          } catch {
            return value;
          }
        })
        // 추천 질문·종합 소견이 비어 있으면 여기서 AI에게 만들게 한다.
        //
        // 예전에는 검사지를 올리는 순간(scan/analyzing.tsx)에만 만들었다. 그래서
        // 기록 탭에서 지난 검사지를 열거나, 재판정을 거친 화면에서는 질문이 비어
        // 엔진이 만든 기계적인 문장으로 떨어졌다. 한 번 만들면 수정분 저장소에
        // 캐시하므로 화면에 들어올 때마다 다시 부르지는 않는다.
        .then(async (value) => {
          if (!value?.items?.length) return value;
          const hasQuestions = (value.questions ?? []).some((q) => q.trim());
          const hasSummary = !!value.summary?.trim();
          if (hasQuestions && hasSummary) return value;

          if (active) setGeneratingInsights(true);
          try {
            const gestationalWeek =
              value.gestationalWeek ?? (await currentPregnancyWeek());
            const insights = await generateReportInsights(value.items, {
              gestationalWeek,
            });
            const next = {
              ...value,
              gestationalWeek,
              summary: hasSummary ? value.summary : insights.summary,
              questions: hasQuestions ? value.questions : insights.questions,
              foods: value.foods?.length ? value.foods : insights.foods,
            };
            // 다음 진입 때 또 부르지 않도록 저장해 둔다.
            await saveReportEdits(editsKey, {
              items: next.items!,
              summary: next.summary,
              questions: next.questions,
              foods: next.foods,
              crossFindings: next.crossFindings,
              unsupported: next.unsupported,
              sources: next.sources,
              signature: reportSignature(next.items),
            }).catch(() => {});
            return next;
          } catch (error) {
            // 실패하면 엔진이 만든 질문으로 화면을 채운다(아래 렌더에서 처리).
            console.warn("[report] AI 추천 질문 생성 실패:", error);
            if (active) {
              setInsightsError(
                error instanceof Error ? error.message : String(error),
              );
            }
            return value;
          } finally {
            if (active) setGeneratingInsights(false);
          }
        })
        .then((value) => {
          if (active) {
            setReport(value);
            setChecking(false);
          }
        });
      return () => {
        active = false;
      };
    }, [recordId, editsKey]),
  );

  const activeItem =
    activeItemIndex != null ? (report?.items?.[activeItemIndex] ?? null) : null;
  // 이미지 위 마커 클릭과 종합 분석 표 행 클릭이 같은 하단 시트를 공유한다.
  // definition/verdict가 비어있으면(OCR이 못 채운 경우) 빈 시트 대신 안내
  // 문구를 대신 보여준다.
  const detail = activeItem
    ? {
        title: activeItem.name,
        originalName: activeItem.originalName,
        status: activeItem.status,
        badgeLabel: activeItem.badgeLabel,
        definition: activeItem.definition || "",
        verdict:
          activeItem.verdict ||
          `이번 수치(${activeItem.value || "정보 없음"})에 대한 자세한 설명을 아직 준비하지 못했어요.`,
        // 판정 엔진이 붙여준 근거들. 값이 없으면(서버에서 온 옛 데이터) 그냥 안 그린다.
        basisLabel: activeItem.basisLabel,
        contrastNote: activeItem.contrastNote,
        caveats: activeItem.caveats ?? [],
        citations: activeItem.citations ?? [],
        doctorQuestion: activeItem.doctorQuestion,
        trendNote: activeItem.trendNote,
      }
    : null;

  /**
   * 확인이 끝난 검사지를 서버에 저장한다(POST /reports).
   *
   * 스캔 직후 자동으로 보내지 않는 이유: 그 시점의 값은 아직 사용자가 확인하기
   * 전이라, OCR이 잘못 읽은 수치가 그대로 기록으로 남는다. 값을 고칠 수 있는
   * 화면에서 "저장하기"를 눌렀을 때만 보낸다.
   */
  async function saveToServer() {
    if (!report?.items?.length || savingToServer) return;
    setSavingToServer(true);
    try {
      const corrected = await submitReport({
        testDate: report.testDate,
        items: report.items,
        summary: report.summary,
        questions: report.questions,
        foods: report.foods,
      });

      // 서버도 임신 기준으로 다시 판정해 돌려주지만 그 판정에는 근거(출처)가 없다.
      // 판정·설명·근거는 엔진 결과를 유지하고, 서버에서는 카탈로그 대표명만 빌려온다.
      let items = report.items;
      if (corrected?.items?.length && items.length === corrected.items.length) {
        items = items.map((item, i) => {
          const fromServer = corrected.items[i];
          if (!fromServer) return item;
          if (!item.engineStatus) {
            // 엔진이 모르는 항목 → 서버 판정을 쓰되 원문명은 유지한다.
            return {
              ...fromServer,
              originalName: item.originalName ?? item.name,
            };
          }
          const displayName = fromServer.name || item.name;
          return {
            ...item,
            name: displayName,
            originalName:
              item.originalName ??
              (displayName !== item.name ? item.name : undefined),
          };
        });
      }

      const next: ReportView = {
        ...report,
        items,
        testSheetId: corrected?.testSheetId,
        week: corrected?.week,
        testDate: corrected?.testDate ?? report.testDate,
      };
      setReport(next);

      // 검사지 사진도 같은 기록에 붙인다.
      // 판정 결과 저장(/reports)이 끝난 뒤라, 사진이 실패해도 기록은 이미 남아 있다.
      // 사진이 없는 건(기록 탭에서 연 지난 검사지) 올릴 것도 없으므로 건너뛴다.
      const photoUploaded =
        report.uri && next.testSheetId != null
          ? await uploadTestSheetImage(next.testSheetId, report.uri)
          : true;

      if (report.uri) {
        await saveLastReport({
          uri: report.uri,
          items,
          testDate: next.testDate,
          summary: report.summary,
          questions: report.questions,
          foods: report.foods,
          crossFindings: report.crossFindings,
          unsupported: report.unsupported,
          sources: report.sources,
          testSheetId: next.testSheetId,
          week: next.week,
        }).catch(() => {});
      }
      setUnsavedChanges(false);
      setSaveNotice(
        photoUploaded ? "기록에 저장했어요." : "기록에 저장했어요. (사진은 올리지 못했어요)",
      );
    } catch (error) {
      console.warn("[report] 검사지 서버 저장 실패:", error);
      setSaveNotice("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSavingToServer(false);
      setTimeout(() => setSaveNotice(null), 2600);
    }
  }

  /** 사용자가 고친 값으로 그 항목만 다시 판정하고 저장한다. */
  async function applyEdit() {
    if (editingIndex == null || !report?.items) return;
    const next = [...report.items];
    const target = next[editingIndex];
    // 참고범위가 붙어 있던 형식("11.2 g/dL (12~16)")을 유지해야 재판정 때 기준을 잃지 않는다.
    const rangePart =
      (target.value ?? "").match(/\([^)]*[-~][^)]*\)/)?.[0] ?? "";
    const unitPart = (target.value ?? "")
      .replace(/^-?\d+(?:\.\d+)?\s*/, "")
      .replace(/\([^)]*\)/, "")
      .trim();
    next[editingIndex] = {
      ...target,
      value: [editValue.trim(), unitPart, rangePart].filter(Boolean).join(" "),
      // 재판정 대상으로 만들기 위해 엔진 표시를 지운다.
      engineStatus: undefined,
      needsConfirm: false,
    };

    setSaving(true);
    try {
      const gestationalWeek = await currentPregnancyWeek();
      const re = reanalyzeItems(next, { gestationalWeek });

      // 수치가 바뀌었으면 종합 소견·추천 질문·추천 재료도 다시 만들어야 한다.
      // 안 그러면 표에는 "안심"인데 질문은 "3.79%로 위험한데…"라고 남아 서로 모순된다.
      let summary = report.summary;
      let questions = report.questions;
      let foods = report.foods;
      try {
        const insights = await generateReportInsights(re.items, {
          gestationalWeek,
        });
        summary = insights.summary;
        questions = insights.questions;
        foods = insights.foods;
      } catch {
        // AI 재생성이 실패하면(키 미설정·네트워크 오류) 옛 문구를 그대로 두지 않는다.
        // 판정 엔진이 항목마다 만들어 둔 질문으로 대체한다 — 표와 항상 일치하고
        // API 호출도 필요 없다.
        summary = buildEngineSummary(re.items, gestationalWeek);
        questions = buildEngineQuestions(re.items);
      }

      const updated = {
        ...report,
        items: re.items,
        crossFindings: re.crossFindings,
        sources: re.sources,
        summary,
        questions,
        foods,
        gestationalWeek,
        // 사용자가 값을 고친 순간부터 이 화면은 더 이상 "서버가 준 그대로"가 아니다.
        // fromServer를 남겨두면 빈 값일 때 "저장된 게 없어요" 문구가 뜬다.
        fromServer: false,
      };
      setReport(updated);

      // 수정분은 항상 저장한다. 서버에서 불러온 검사지(uri 없음)도 마찬가지다 —
      // 예전엔 여기서 걸러져서 "고쳐도 새로고침하면 원래대로" 문제가 났다.
      await saveReportEdits(editsKey, {
        items: re.items,
        summary,
        questions,
        foods,
        crossFindings: re.crossFindings,
        unsupported: re.unsupported,
        sources: re.sources,
        signature: reportSignature(re.items),
      }).catch(() => {});

      // 방금 올린 검사지라면 원본(마지막 리포트)도 함께 갱신해 둔다.
      // 서버 식별자(testSheetId·week·testDate)는 지우지 않고 그대로 넘긴다.
      if (report.uri) {
        await saveLastReport({
          uri: report.uri,
          items: re.items,
          testDate: report.testDate,
          summary,
          questions,
          foods,
          crossFindings: re.crossFindings,
          unsupported: re.unsupported,
          sources: re.sources,
          testSheetId: report.testSheetId,
          week: report.week,
        }).catch(() => {});
      }
      // 이미 서버에 저장한 검사지라면, 고친 값을 다시 올릴 수 있게 버튼을 되살린다.
      if (report.testSheetId) setUnsavedChanges(true);
    } finally {
      setSaving(false);
      setEditingIndex(null);
      setActiveItemIndex(null);
    }
  }

  /**
   * 직접 적은 질문을 서버에 올린다.
   *
   * 지금 보고 있는 검사지가 있으면 그 검사지에 달아서, 캘린더에서 그 검사지
   * 다음 진료를 펼쳤을 때 추천 질문과 함께 보이게 한다.
   * (예전에는 그 날 일정의 questions 배열을 통째로 교체하는 방식이라,
   *  일정이 없는 날은 서버에 붙을 곳이 없어 기기에만 남았다.)
   */
  async function submitQuestion() {
    const text = question.trim();
    if (!text || sendingQuestion) return;
    setSendingQuestion(true);
    try {
      await createQuestion(text, recordId ?? null);
      setQuestion("");
      setQuestionNotice("다음 진료 질문에 추가했어요.");
    } catch (error) {
      // 실패를 조용히 넘기면 사용자는 저장된 줄 안다. 반드시 알린다.
      console.warn("[report] 질문 저장 실패:", error);
      setQuestionNotice(
        "질문을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setSendingQuestion(false);
      setTimeout(() => setQuestionNotice(null), 2600);
    }
  }

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
      <LinearGradient
        colors={["#FFFCFD", "#FFEBF3"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={goBack}>
            <BackChevronIcon size={24} />
          </Pressable>
          {/* 기록 탭에서 지난 검사지를 열었을 때는 제목을 두지 않는다.
              분석 탭 스택에서 온 경우에만 "분석"을 보여준다. */}
          {from !== "record" && (
            <Text style={styles.headerTitle} pointerEvents="none">
              분석
            </Text>
          )}
          <Pressable hitSlop={8} onPress={() => router.replace("/(tabs)/home")}>
            <CloseIcon size={24} />
          </Pressable>
        </View>

        {!checking && !report && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>아직 분석된 검사지가 없어요</Text>
            <Text style={styles.emptyBody}>
              검사지를 업로드하면 쉬운 번역본을 볼 수 있어요.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/(modals)/scan")}
            >
              <Text style={styles.emptyButtonText}>검사지 업로드하기</Text>
            </Pressable>
          </View>
        )}

        {report && (
          <ScrollView
            style={centeredContentStyle}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* 이미지 위 마커는 OCR이 추정한 위치가 부정확해서(항목 텍스트와
                안 맞는 곳에 찍힘) 뺐다 — 항목 상세는 아래 종합 분석 표의
                행을 눌러서만 연다. */}
            {report.uri && (
              <>
                <Text style={styles.sectionTitle}></Text>
                <View style={[styles.imageWrap, { aspectRatio: imageAspect }]}>
                  <Image
                    source={{ uri: report.uri }}
                    style={[styles.image, styles.scanFilter]}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.zoomHint}>
                  *두 손가락으로 확대/축소를 해보세요
                </Text>
              </>
            )}

            <View style={styles.card}>
              <Pressable
                style={styles.cardHeader}
                onPress={() => setSummaryOpen((v) => !v)}
              >
                <Text style={styles.cardTitle}>종합 분석</Text>
                <View
                  style={{
                    transform: [{ rotate: summaryOpen ? "90deg" : "0deg" }],
                  }}
                >
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
                        {report.summary?.trim() ||
                          buildEngineSummary(
                            report.items ?? [],
                            report.gestationalWeek,
                          )}
                      </Text>
                      {/* 항목 하나만 봐서는 안 보이는 소견. 예: 헤모글로빈은 정상인데
                          페리틴이 낮은 "빈혈 전 단계", 단백뇨가 음성이어도 성립하는
                          임신중독증 조합. 표보다 위에 둬야 놓치지 않는다. */}
                      {/* OCR을 못 믿겠는 항목을 맨 위에 모아 보여준다. 표 안에 섞어두면
                          사용자가 놓치고, 잘못 읽은 값이 그대로 기록으로 남는다. */}
                      {(() => {
                        // 두 경우는 성격이 다르다. 섞어 보여주면 "값이 없는 항목"까지
                        // 오독으로 오해하게 된다.
                        //  · 결과 없음 : 검사지에 값이 없거나 못 읽음 → 직접 입력이 필요
                        //  · 숫자 의심 : 값은 읽었는데 자릿수 등이 수상함 → 확인이 필요
                        const all = (report.items ?? []).filter(
                          (it) => it.needsConfirm,
                        );
                        if (all.length === 0) return null;
                        const missing = all.filter(
                          (it) => it.badgeLabel === "결과 없음",
                        );
                        const suspect = all.filter(
                          (it) => it.badgeLabel !== "결과 없음",
                        );
                        const openFirst = (target: typeof all) => {
                          const i = (report.items ?? []).indexOf(target[0]);
                          if (i >= 0) setActiveItemIndex(i);
                        };
                        return (
                          <>
                            {suspect.length > 0 && (
                              <Pressable
                                style={styles.confirmCard}
                                onPress={() => openFirst(suspect)}
                              >
                                <Text style={styles.confirmTitle}>
                                  숫자를 확인해 주세요 · {suspect.length}개
                                </Text>
                                <Text style={styles.confirmBody}>
                                  사진에서 잘못 읽었을 수 있는 항목이에요. 잘못
                                  읽은 값으로 판정하지 않으려고 일부러
                                  멈춰뒀어요.
                                </Text>
                                <Text style={styles.confirmNames}>
                                  {suspect.map((it) => it.name).join(" · ")}
                                </Text>
                              </Pressable>
                            )}
                            {missing.length > 0 && (
                              <Pressable
                                style={styles.missingCard}
                                onPress={() => openFirst(missing)}
                              >
                                <Text style={styles.missingTitle}>
                                  값을 읽지 못한 항목 · {missing.length}개
                                </Text>
                                <Text style={styles.missingBody}>
                                  검사지에서 결과값을 찾지 못했어요. 항목을 눌러
                                  직접 입력하면 바로 판정해 드릴게요.
                                </Text>
                                <Text style={styles.missingNames}>
                                  {missing.map((it) => it.name).join(" · ")}
                                </Text>
                              </Pressable>
                            )}
                          </>
                        );
                      })()}
                      {report.crossFindings?.map((f, i) => (
                        <View key={`cf-${i}`} style={styles.crossCard}>
                          <Text style={styles.crossTitle}>
                            함께 볼 소견 — {f.name}
                          </Text>
                          <Text style={styles.crossBody}>{f.message}</Text>
                          {f.conditions.length > 0 && (
                            <Text style={styles.crossCond}>
                              해당 항목: {f.conditions.join(", ")}
                            </Text>
                          )}
                        </View>
                      ))}
                      <View style={styles.table}>
                        <View style={styles.tableHeaderRow}>
                          <Text
                            style={[styles.tableHeaderCell, styles.colName]}
                          >
                            검사항목
                          </Text>
                          <Text
                            style={[styles.tableHeaderCell, styles.colValue]}
                          >
                            수치
                          </Text>
                          <Text
                            style={[styles.tableHeaderCell, styles.colStatus]}
                          >
                            상태
                          </Text>
                        </View>
                        {report.items.map((item, i) => (
                          <Pressable
                            key={`${item.name}-${i}`}
                            style={({ pressed }) => [
                              styles.tableRow,
                              i === report.items!.length - 1 &&
                                styles.tableRowLast,
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
                                <Text
                                  style={styles.tableCellOriginal}
                                  numberOfLines={1}
                                >
                                  {item.originalName}
                                </Text>
                              )}
                            </View>
                            <Text
                              style={[styles.tableCell, styles.colValue]}
                              numberOfLines={2}
                            >
                              {item.value || "-"}
                            </Text>
                            <View style={styles.colStatus}>
                              <StatusBadge status={item.status} />
                            </View>
                          </Pressable>
                        ))}
                      </View>
                      {/* 조용히 빠지면 사용자는 "정상이라 안 나왔나 보다"로 오해한다. */}
                      {report.unsupported && report.unsupported.length > 0 && (
                        <View style={styles.unsupportedBox}>
                          <Text style={styles.unsupportedTitle}>
                            아직 설명하지 않는 항목
                          </Text>
                          {report.unsupported.map((u, i) => (
                            <Text
                              key={`us-${i}`}
                              style={styles.unsupportedItem}
                            >
                              {u.name} {u.value ? `· ${u.value}` : ""}
                            </Text>
                          ))}
                          <Text style={styles.unsupportedHint}>
                            정상이라는 뜻이 아니에요.
                          </Text>
                        </View>
                      )}
                      {/* 판정 근거를 화면에서 숨기지 않는다 — 이 앱의 신뢰도 자체다. */}
                      {report.sources && report.sources.length > 0 && (
                        <View style={styles.sourceBox}>
                          <Text style={styles.sourceTitle}>판정 근거</Text>
                          {report.sources.map((src, i) => (
                            <Pressable
                              key={`src-${i}`}
                              onPress={() =>
                                src.url && Linking.openURL(src.url)
                              }
                              style={({ pressed }) => [
                                pressed && styles.pressed,
                              ]}
                            >
                              <Text style={styles.sourceItem}>
                                {src.label}{" "}
                                <Text style={styles.sourceBadge}>
                                  {src.badge}
                                </Text>
                              </Text>
                            </Pressable>
                          ))}
                          <Text style={styles.sourceHint}>
                            진단이 아닌 정보 제공입니다.
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={styles.summaryText}>
                      {report.fromServer
                        ? "검사 항목을 불러오지 못했어요."
                        : DEMO_SUMMARY}
                    </Text>
                  )}
                </>
              )}
            </View>

            <View style={styles.questionCard}>
              <Text style={styles.cardTitle}>다음 진료 추천 질문</Text>
              {(() => {
                // 저장된 AI 질문이 있으면 그걸 쓰고, 없으면 판정 결과로 즉석에서 만든다.
                // 예전에는 여기서 DEMO 예시("Ex) 당 수치가…")로 떨어졌는데, 내 검사지와
                // 아무 상관 없는 문장이라 사용자에게는 앱이 동작하지 않는 것으로 보였다.
                if (generatingInsights) {
                  return (
                    <Text style={styles.cardHint}>
                      검사 결과를 바탕으로 질문을 만드는 중이에요…
                    </Text>
                  );
                }
                const saved = report.questions?.filter((q) => q.trim()) ?? [];
                const list =
                  saved.length > 0
                    ? saved
                    : buildEngineQuestions(report.items ?? []);
                if (list.length > 0) {
                  return list.map((q, i) => (
                    <View key={i} style={styles.exampleRow}>
                      <AiQuestionIcon />
                      <Text style={styles.example}>{q}</Text>
                    </View>
                  ));
                }
                return (
                  <Text style={styles.cardHint}>
                    {report.items?.length
                      ? "지금 결과에서 따로 여쭤볼 항목은 없어요. 궁금한 점을 직접 적어보세요."
                      : "검사 항목을 불러오지 못해 추천 질문을 만들 수 없어요."}
                  </Text>
                );
              })()}
              {/* 개발 중에만 보이는 진단 문구. AI가 실패하면 엔진 문장으로 대체되는데,
                  그 사실이 화면에 안 보이면 "AI가 만든 질문"으로 오해하게 된다. */}
              {__DEV__ && !!insightsError && (
                <Text style={styles.debugNote}>
                  AI 질문 생성 실패 · {insightsError}
                </Text>
              )}
              <View style={styles.inputWrap}>
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="질문 입력하기"
                  placeholderTextColor="#A0A0A0"
                  style={styles.input}
                  returnKeyType="send"
                  onSubmitEditing={submitQuestion}
                  editable={!sendingQuestion}
                />
                {question.trim().length > 0 && (
                  <Pressable
                    onPress={submitQuestion}
                    disabled={sendingQuestion}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="질문 추가"
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <Text
                      style={[
                        styles.sendArrow,
                        sendingQuestion && styles.sendDisabled,
                      ]}
                    >
                      ↑
                    </Text>
                  </Pressable>
                )}
              </View>
              {!!questionNotice && (
                <Text style={styles.sentNotice}>{questionNotice}</Text>
              )}
            </View>

            <View style={styles.card}>
              <Pressable
                style={styles.cardHeader}
                onPress={() => setIngredientsOpen((v) => !v)}
              >
                <Text style={styles.cardTitle}>추천 재료</Text>
                <View
                  style={{
                    transform: [{ rotate: ingredientsOpen ? "90deg" : "0deg" }],
                  }}
                >
                  <ChevronRightIcon size={20} />
                </View>
              </Pressable>
              {ingredientsOpen &&
                // 재료도 비었을 때 빈 카드를 남기지 않는다. AI 추천이 없으면 기본 재료를 보여준다.
                (report.foods?.length || report.items?.length ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.ingredients}
                  >
                    {(report.foods && report.foods.length > 0
                      ? report.foods
                      : DEMO_INGREDIENTS.map((name) => ({ name, reason: "" }))
                    ).map((food) => (
                      <View key={food.name} style={styles.ingredient}>
                        <FoodImage name={food.name} />
                        <Text style={styles.ingredientName}>{food.name}</Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.cardHint}>
                    이 검사지에 저장된 추천 재료가 없어요.
                  </Text>
                ))}
            </View>
            {/* 방금 올린 검사지이고 아직 서버에 저장하지 않았을 때만 보여준다.
                스캔 직후 자동 전송을 없앤 대신, 값을 확인·수정한 뒤 여기서 저장한다. */}
            {report.uri && !report.fromServer && (
              <View style={styles.saveBox}>
                {report.testSheetId && !unsavedChanges ? (
                  <Text style={styles.savedText}>
                    기록에 저장됨{report.week ? ` · ${report.week}` : ""}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.saveHint}>
                      {unsavedChanges
                        ? "수정한 값이 아직 기록에 반영되지 않았어요."
                        : "수치를 확인하고 저장하면 기록 탭에서 다시 볼 수 있어요."}
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.saveButton,
                        (savingToServer || !report.items?.length) &&
                          styles.saveDisabled,
                        pressed && styles.pressed,
                      ]}
                      onPress={saveToServer}
                      disabled={savingToServer || !report.items?.length}
                    >
                      <Text style={styles.saveButtonText}>
                        {savingToServer
                          ? "저장하는 중…"
                          : unsavedChanges
                            ? "수정한 값으로 다시 저장"
                            : "저장하기"}
                      </Text>
                    </Pressable>
                  </>
                )}
                {!!saveNotice && (
                  <Text style={styles.saveNotice}>{saveNotice}</Text>
                )}
              </View>
            )}
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
              <View style={styles.sheetTitleRow}>
                <Text style={styles.sheetTitle}>{detail.title}</Text>
                {detail.originalName && (
                  <Text style={styles.sheetTitleOriginal}>
                    {detail.originalName}
                  </Text>
                )}
                <StatusBadge status={detail.status} />
              </View>
              {!!detail.definition && (
                <Text style={styles.sheetDefinition}>{detail.definition}</Text>
              )}
              <View style={styles.sheetDivider} />
              <ScrollView
                style={styles.sheetScroll}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.sheetVerdict}>{detail.verdict}</Text>
                {/* 칩에서 뺀 세부 판정("중등도 빈혈", "기준 없음")은 여기서 되살린다.
                    표에서는 심각도만 보이고, 자세한 말은 열어봤을 때 나오게 한다. */}
                {!!detail.badgeLabel && detail.badgeLabel !== detail.status && (
                  <View style={styles.basisChip}>
                    <Text style={styles.basisText}>
                      판정 · {detail.badgeLabel}
                    </Text>
                  </View>
                )}
                {/* 무엇과 비교해서 나온 판정인지 — 사용자가 가장 먼저 궁금해하는 것. */}
                {!!detail.basisLabel && (
                  <View style={styles.basisChip}>
                    <Text style={styles.basisText}>
                      기준 · {detail.basisLabel}
                    </Text>
                  </View>
                )}
                {/* 검사지에는 빨간 표시인데 임신 중 기준으로는 정상인 경우의 설명. */}
                {!!detail.contrastNote && (
                  <Text style={styles.contrastBox}>{detail.contrastNote}</Text>
                )}
                {!!detail.trendNote && (
                  <Text style={styles.contrastBox}>{detail.trendNote}</Text>
                )}
                {detail.caveats.map((c, i) => (
                  <Text key={`cv-${i}`} style={styles.caveatBox}>
                    {c}
                  </Text>
                ))}
                {!!detail.doctorQuestion && (
                  <Text style={styles.askBox}>
                    다음 진료 때 이렇게 물어보세요{"\n"}“{detail.doctorQuestion}
                    ”
                  </Text>
                )}
                {/* 어떤 항목이든 잘못 읽혔을 수 있으니 수정 경로는 항상 열어둔다. */}
                <Pressable
                  style={styles.editBtn}
                  onPress={() => {
                    setEditingIndex(activeItemIndex);
                    setEditValue(
                      (activeItem?.value ?? "").match(/-?\d+(?:\.\d+)?/)?.[0] ??
                        "",
                    );
                  }}
                >
                  <Text style={styles.editBtnText}>
                    {detail.status === "확인 필요"
                      ? "숫자를 직접 입력하기"
                      : "숫자가 잘못 읽혔나요? 수정하기"}
                  </Text>
                </Pressable>
                {detail.citations.length > 0 && (
                  <View style={styles.citeBox}>
                    {detail.citations.map((c, i) => (
                      <Pressable
                        key={`ct-${i}`}
                        onPress={() => c.url && Linking.openURL(c.url)}
                        style={({ pressed }) => [pressed && styles.pressed]}
                      >
                        <Text style={styles.citeItem}>
                          근거 · {c.label}{" "}
                          <Text style={styles.citeBadge}>{c.badge}</Text>
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </ScrollView>
              {/* 닫기 버튼은 제목 줄과 같은 자리(오른쪽 위)에 절대 배치된다.
                  형제 중 마지막에 그려야 제목 줄·상태 배지에 터치를 뺏기지
                  않는다 — RN에서는 position:absolute가 z축을 올려주지 않고
                  나중에 그려진 형제가 위에 오기 때문이다. */}
              <Pressable
                hitSlop={12}
                style={styles.sheetClose}
                onPress={closeDetail}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <CloseIcon size={16} />
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* 숫자 수정 모달 — 고치면 그 자리에서 다시 판정한다(서버 왕복 없음). */}
      <Modal
        transparent
        visible={editingIndex != null}
        animationType="fade"
        onRequestClose={() => setEditingIndex(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setEditingIndex(null)}
          />
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>
              {editingIndex != null ? report?.items?.[editingIndex]?.name : ""}
            </Text>
            <Text style={styles.editHint}>
              검사지에 적힌 숫자를 그대로 입력해 주세요. 단위와 참고범위는
              그대로 두고 숫자만 바꿉니다.
            </Text>
            <Text style={styles.editOriginal}>
              현재 읽은 값 ·{" "}
              {editingIndex != null
                ? report?.items?.[editingIndex]?.value || "-"
                : ""}
            </Text>
            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="decimal-pad"
              placeholder="예) 37.9"
              placeholderTextColor="#A0A0A0"
              style={styles.editInput}
              autoFocus
            />
            <View style={styles.editRow}>
              <Pressable
                style={[styles.editAction, styles.editCancel]}
                onPress={() => setEditingIndex(null)}
              >
                <Text style={styles.editCancelText}>취소</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.editAction,
                  styles.editSave,
                  (!editValue.trim() || saving) && styles.editDisabled,
                ]}
                onPress={applyEdit}
                disabled={!editValue.trim() || saving}
              >
                <Text style={styles.editSaveText}>
                  {saving ? "다시 분석 중…" : "저장하고 다시 분석"}
                </Text>
              </Pressable>
            </View>
          </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    color: "#111",
    fontFamily: "Pretendard-Medium",
    fontSize: 16,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
  },
  pressed: { opacity: 0.78 },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: "#111",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 18,
  },
  emptyBody: {
    color: "#707070",
    fontFamily: "Pretendard-Regular",
    fontSize: 14,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 12,
    height: 46,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "#FA0C56",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButtonText: {
    color: "#FFFDF9",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 16,
  },

  sectionTitle: {
    paddingHorizontal: 2,
    color: "#111",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 16,
  },

  // ---- 판정 엔진(lib/labs)이 만든 근거를 보여주는 요소들 ----
  crossCard: {
    backgroundColor: "#FBF1DC",
    borderRadius: 11,
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  crossTitle: {
    color: "#6B4A0E",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 13,
  },
  crossBody: {
    color: "#7A5410",
    fontFamily: "Pretendard-Regular",
    fontSize: 12.5,
    lineHeight: 19,
  },
  crossCond: {
    color: "#9A7A3A",
    fontFamily: "Pretendard-Regular",
    fontSize: 11.5,
  },

  unsupportedBox: {
    backgroundColor: "#FAFAF8",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#EBEBE6",
    borderStyle: "dashed",
    padding: 12,
    marginBottom: 10,
    gap: 3,
  },
  unsupportedTitle: {
    color: "#5C5C57",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 12.5,
  },
  unsupportedItem: {
    color: "#8A8A82",
    fontFamily: "Pretendard-Regular",
    fontSize: 12,
  },
  unsupportedHint: {
    color: "#A0A0A0",
    fontFamily: "Pretendard-Regular",
    fontSize: 11,
    marginTop: 2,
  },

  sourceBox: {
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#EFEFEF",
    gap: 4,
  },
  sourceTitle: {
    color: "#707070",
    fontFamily: "Pretendard-Medium",
    fontSize: 12,
  },
  sourceItem: {
    color: "#8A8A82",
    fontFamily: "Pretendard-Regular",
    fontSize: 11,
    lineHeight: 17,
  },
  sourceBadge: {
    color: "#2E7D52",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 10,
  },
  sourceHint: {
    color: "#A0A0A0",
    fontFamily: "Pretendard-Regular",
    fontSize: 10.5,
    marginTop: 2,
  },

  // ---- OCR 오독 확인·수정 ----
  missingCard: {
    backgroundColor: "#F5F5F2",
    borderRadius: 11,
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  missingTitle: {
    color: "#4A4A44",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 13,
  },
  missingBody: {
    color: "#5C5C57",
    fontFamily: "Pretendard-Regular",
    fontSize: 12.5,
    lineHeight: 19,
  },
  missingNames: {
    color: "#8A8A82",
    fontFamily: "Pretendard-Medium",
    fontSize: 11.5,
    marginTop: 2,
  },
  confirmCard: {
    backgroundColor: "#E6EEF7",
    borderRadius: 11,
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  confirmTitle: {
    color: "#22507C",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 13,
  },
  confirmBody: {
    color: "#2A5D8F",
    fontFamily: "Pretendard-Regular",
    fontSize: 12.5,
    lineHeight: 19,
  },
  confirmNames: {
    color: "#4C7BAD",
    fontFamily: "Pretendard-Medium",
    fontSize: 11.5,
    marginTop: 2,
  },
  editBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDD9D2",
  },
  editBtnText: {
    color: "#5C5C57",
    fontFamily: "Pretendard-Medium",
    fontSize: 12.5,
  },
  editSheet: {
    position: "absolute",
    left: 20,
    right: 20,
    top: "28%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 9,
    ...shadow,
  },
  editTitle: { color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 16 },
  editHint: {
    color: "#707070",
    fontFamily: "Pretendard-Regular",
    fontSize: 12.5,
    lineHeight: 19,
  },
  editOriginal: {
    color: "#A0A0A0",
    fontFamily: "Pretendard-Regular",
    fontSize: 12,
  },
  editInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E3E3DE",
    paddingHorizontal: 14,
    fontFamily: "Pretendard-Medium",
    fontSize: 16,
    color: "#111",
    marginTop: 2,
  },
  editRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  editAction: {
    flex: 1,
    height: 46,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancel: { backgroundColor: "#F2F2EE" },
  editCancelText: {
    color: "#5C5C57",
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
  },
  editSave: { backgroundColor: "#FA0C56" },
  editSaveText: {
    color: "#FFFDF9",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 14,
  },
  editDisabled: { opacity: 0.45 },

  sendArrow: {
    color: "#FA0C56",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 18,
    paddingHorizontal: 6,
  },
  sendDisabled: { opacity: 0.4 },
  sentNotice: {
    marginTop: 6,
    color: "#3A6B5C",
    fontFamily: "Pretendard-Medium",
    fontSize: 12,
  },

  debugNote: {
    color: "#B03A2E",
    fontFamily: "Pretendard-Regular",
    fontSize: 11,
    lineHeight: 16,
  },
  saveBox: { marginTop: 4, gap: 8, alignItems: "stretch" },
  saveHint: {
    textAlign: "center",
    color: "#8A8A82",
    fontFamily: "Pretendard-Regular",
    fontSize: 12.5,
  },
  saveButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#FA0C56",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFDF9",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 16,
  },
  saveDisabled: { opacity: 0.45 },
  savedText: {
    textAlign: "center",
    color: "#2E7D52",
    fontFamily: "Pretendard-Medium",
    fontSize: 13,
  },
  saveNotice: {
    textAlign: "center",
    color: "#3A6B5C",
    fontFamily: "Pretendard-Medium",
    fontSize: 12,
  },

  sheetScroll: { maxHeight: 320 },
  basisChip: {
    alignSelf: "flex-start",
    backgroundColor: "#F5F5F2",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 10,
  },
  basisText: {
    color: "#5C5C57",
    fontFamily: "Pretendard-Medium",
    fontSize: 11.5,
  },
  contrastBox: {
    backgroundColor: "#E6EEF7",
    color: "#2A5D8F",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    fontFamily: "Pretendard-Regular",
    fontSize: 12.5,
    lineHeight: 19,
  },
  caveatBox: {
    backgroundColor: "#FAFAF8",
    color: "#5C5C57",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    fontFamily: "Pretendard-Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  askBox: {
    color: "#3A6B5C",
    marginTop: 12,
    fontFamily: "Pretendard-Medium",
    fontSize: 12.5,
    lineHeight: 19,
  },
  citeBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#EFEFEF",
    gap: 3,
    paddingBottom: 8,
  },
  citeItem: {
    color: "#8A8A82",
    fontFamily: "Pretendard-Regular",
    fontSize: 11,
    lineHeight: 17,
  },
  citeBadge: {
    color: "#2E7D52",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 10,
  },
  // aspectRatio는 렌더링 시 실제 업로드 사진 비율로 덮어쓴다(기본값은 초기 로딩 중 fallback).
  imageWrap: {
    alignSelf: "center",
    width: "79%",
    borderRadius: 8,
    overflow: "visible",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#FFF0F6",
  },
  // scanDocumentImage(lib/scan.ts)가 정리해준 사진을 "스캔한 문서"처럼
  // 흑백·고대비 톤으로 보여준다. 실제 픽셀은 원본 그대로 둔다.
  // filter는 웹에서만 동작하고 RN 타입에는 없어서 캐스팅해서 넘긴다.
  scanFilter: {
    filter: [{ grayscale: 1 }, { contrast: 1.6 }, { brightness: 1.05 }],
  } as unknown as ImageStyle,
  zoomHint: {
    alignSelf: "center",
    color: "#A0A0A0",
    fontFamily: "Pretendard-Regular",
    fontSize: 12,
    marginTop: -4,
  },

  card: {
    paddingTop: 11,
    paddingHorizontal: 18,
    paddingBottom: 4,
    borderRadius: 14,
    backgroundColor: "#FFFCFD",
    gap: 8,
    ...shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 24,
  },
  cardTitle: { color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 16 },
  summaryText: {
    color: "#111",
    fontFamily: "Pretendard-Regular",
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 14,
  },

  // parseTestReport(lib/ocr.ts)가 읽어낸 검사항목/수치/상태 표.
  table: { paddingBottom: 12 },
  tableHeaderRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EFEFEF",
  },
  tableHeaderCell: {
    color: "#707070",
    fontFamily: "Pretendard-Medium",
    fontSize: 12,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EFEFEF",
  },
  tableRowLast: { borderBottomWidth: 0 },
  tableCell: {
    color: "#111",
    fontFamily: "Pretendard-Regular",
    fontSize: 13,
    lineHeight: 18,
    paddingRight: 6,
  },
  colName: { flex: 1.15, paddingRight: 6 },
  tableCellOriginal: {
    marginTop: 1,
    color: "#A0A0A0",
    fontFamily: "Pretendard-Regular",
    fontSize: 11,
    lineHeight: 15,
  },
  cardHint: {
    paddingVertical: 8,
    paddingBottom: 14,
    color: "#A0A0A0",
    fontFamily: "Pretendard-Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  colValue: { flex: 0.95 },
  colStatus: { width: 65, alignItems: "flex-start" },

  questionCard: {
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 14,
    borderRadius: 14,
    backgroundColor: "#FFFCFD",
    gap: 8,
    ...shadow,
  },
  exampleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  example: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 14 },
  inputWrap: {
    height: 41,
    borderRadius: 8,
    justifyContent: "center",
    backgroundColor: "#FFF0F6",
  },
  input: {
    height: "100%",
    paddingHorizontal: 15,
    color: "#111",
    fontFamily: "Pretendard-Medium",
    fontSize: 14,
  },

  ingredients: { paddingBottom: 12, gap: 8 },
  ingredient: {
    width: 67,
    height: 76,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    backgroundColor: "#FFF0F6",
  },
  ingredientName: {
    color: "#707070",
    fontFamily: "Pretendard-Medium",
    fontSize: 12,
  },

  // justifyContent: "flex-end"이라 시트(유일한 in-flow 자식)는 항상 하단에
  // 붙고, backdrop은 absoluteFill이라 시트 뒤(둥근 모서리 바깥 포함) 화면
  // 전체를 덮는다.
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
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
  // 터치 영역을 넉넉히 잡으려고 padding을 주고, 그만큼 위치를 당겨
  // 아이콘 자체는 기존과 같은 자리(right 20 / top 16)에 보이게 한다.
  sheetClose: {
    position: "absolute",
    right: 12,
    top: 8,
    padding: 8,
    zIndex: 2,
    elevation: 2,
  },
  // 닫기 버튼과 겹치지 않도록 제목 줄 오른쪽을 비워둔다.
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 28,
  },
  sheetTitle: { color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16 },
  sheetTitleOriginal: {
    flex: 1,
    color: "#A0A0A0",
    fontFamily: "Pretendard-Regular",
    fontSize: 12,
  },
  sheetDefinition: {
    color: "#111",
    fontFamily: "Pretendard-Regular",
    fontSize: 12,
    lineHeight: 18,
  },
  sheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E5E5",
  },
  sheetVerdict: {
    color: "#111",
    fontFamily: "Pretendard-Regular",
    fontSize: 12,
    lineHeight: 18,
  },
});
