import { useCallback, useEffect, useRef, useState } from "react";
import { headerBar } from "@/lib/theme";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  AiQuestionIcon,
  BackChevronIcon,
  ChevronRightIcon,
  EditOutlineIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  deleteVisit,
  formatVisitTime,
  getCalendarMonthMarks,
  getVisitDetail,
  getVisitsByDate,
  saveVisitQuestions,
  type CalendarVisit,
  type DayMark,
  type Report,
  type VisitDetail,
} from "@/lib/api";

/** "2026-08-15" → "2026. 08. 15" */
function formatDate(value: string | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}. ${month}. ${day}`;
}

/** "2026-08-15" → "26.08.15" (일정 데이터의 날짜 형식) */
function toVisitKey(value: string | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";
  return `${year.slice(2)}.${month}.${day}`;
}

// Figma: 캘린더_일정
// 진료가 있는 날짜를 눌렀을 때 여는 상세 화면.
// 당일/이전 검사지와 다음 진료 때 물어볼 질문을 관리한다.
export default function CalendarDay() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();
  // 직접 입력한 질문들. 마지막 칸을 채우면 아래에 추가 칸이 생긴다.
  const [questions, setQuestions] = useState<string[]>([""]);

  const updateQuestion = (index: number, value: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  // 화면을 떠날 때 저장하려면 최신 입력값을 참조로 들고 있어야 한다.
  const questionsRef = useRef(questions);
  questionsRef.current = questions;

  /** 입력이 끝나면(포커스 아웃) 그 시점의 질문을 저장한다. */
  const persistQuestions = (next: string[]) => {
    if (!visitKey) return;
    saveVisitQuestions(visitKey, next);
  };

  const hasAddedQuestion = questions.some((question) => question.trim().length > 0);
  const canAddMore =
    hasAddedQuestion && questions[questions.length - 1].trim().length > 0;

  const [detail, setDetail] = useState<VisitDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  // 하루에 여러 일정이 있을 수 있어, 각각을 따로 수정·삭제한다.
  const [dayVisits, setDayVisits] = useState<CalendarVisit[]>([]);
  const [pendingDelete, setPendingDelete] = useState<CalendarVisit | null>(null);

  const visitKey = toVisitKey(date);

  const [dayMark, setDayMark] = useState<DayMark | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setDetailLoading(true);
    getVisitDetail(visitKey).then((result) => {
      if (!active) return;
      setDetail(result);
      setDetailLoading(false);
      // 저장해둔 질문이 있으면 이어서 편집할 수 있게 채운다.
      setQuestions(result.questions.length > 0 ? [...result.questions, ""] : [""]);
    });
    return () => {
      active = false;
    };
  }, [visitKey]);

  // 산전 검사 기록이 있는 날인지 확인 (검사지·질문 카드 노출 여부를 가른다)
  useEffect(() => {
    if (!date) return;
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return;
    let active = true;
    getCalendarMonthMarks(year, month - 1).then((marks) => {
      if (active) setDayMark(marks.marks[day]);
    });
    return () => {
      active = false;
    };
  }, [date]);

  // 일정 시트에서 돌아왔을 때 목록을 다시 읽는다.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getVisitsByDate(visitKey).then((visits) => {
        if (active) setDayVisits(visits);
      });
      return () => {
        active = false;
        // 입력칸에 포커스가 남은 채로 나가도 질문이 사라지지 않도록 한번 더 저장한다.
        if (visitKey) saveVisitQuestions(visitKey, questionsRef.current);
      };
    }, [visitKey]),
  );

  const openEditSheet = (visit: CalendarVisit) => {
    router.push({
      pathname: "/calendar-time",
      params: {
        mode: "edit",
        visitId: visit.id,
        date: visit.date,
        title: visit.title,
        place: visit.place,
        meridiem: visit.meridiem,
        hour: String(visit.hour),
        minute: String(visit.minute),
        isHospital: String(visit.isHospital),
        questions: JSON.stringify(visit.questions),
      },
    });
  };

  /**
   * 검사지 카드를 누르면 그 검사지의 분석 화면으로 넘어간다.
   * id는 서버가 준 이미지 경로에서 뽑아낸 값이라(응답에 별도 필드가 없다)
   * 없을 수도 있는데, 그때는 눌러도 아무 일도 일어나지 않게 둔다.
   */
  const openReport = (report: Report | null) => {
    if (!report?.testSheetId) return;
    router.push({
      pathname: "/(tabs)/analysis/report",
      params: { recordId: String(report.testSheetId) },
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteVisit(pendingDelete.id);
    setPendingDelete(null);
    setDayVisits(await getVisitsByDate(visitKey));
  };

  // 검사지가 아직 없는 일정은 질문도 준비되지 않은 상태로 보여준다.
  const previousReport = detail?.previousReport ?? null;
  const todayReport = detail?.todayReport ?? null;
  const suggestedQuestions = detail?.suggestedQuestions ?? [];

  // 산부인과 진료일에는 검사지·질문 카드를 노출한다. 다른 병원 일정만 있는 날은
  // 일정 목록만 보여주면 충분하다.
  //
  // 다만 서버가 그 날짜에 대해 검사지나 추천 질문을 이미 내려줬다면(예: 지난
  // 진료일에 검사지를 나중에 올린 경우) 산부인과 일정이 등록돼 있지 않아도
  // 보여준다 — 안 그러면 올린 검사지와 AI 질문이 화면에서 사라진다.
  const isPrenatalDay =
    dayMark !== undefined ||
    dayVisits.some((visit) => visit.isHospital) ||
    !!todayReport ||
    !!previousReport ||
    suggestedQuestions.length > 0;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <BackChevronIcon color="#111111" />
          </Pressable>
          <Text style={styles.headerTitle}>캘린더</Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.doneText}>완료</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.dateText}>{formatDate(date)}</Text>

          {/* 이 날 등록된 일정들. 산부인과·타 병원이 섞여 있어도 각각 관리한다. */}
          <View style={styles.scheduleCard}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.scheduleTitle}>이 날의 일정</Text>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  router.push({
                    pathname: "/calendar-time",
                    params: { date: visitKey },
                  })
                }
              >
                <Text style={styles.scheduleAddText}>추가</Text>
              </Pressable>
            </View>

            {dayVisits.length === 0 ? (
              <Text style={styles.scheduleEmptyText}>등록된 일정이 없습니다.</Text>
            ) : (
              dayVisits.map((visit, i) => (
                <View
                  key={visit.id}
                  style={[styles.scheduleRow, i > 0 && styles.scheduleRowDivider]}
                >
                  <View
                    style={[
                      styles.scheduleTag,
                      visit.isHospital
                        ? styles.scheduleTagHospital
                        : styles.scheduleTagOther,
                    ]}
                  />
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleName} numberOfLines={1}>
                      {visit.title || visit.place || "제목 없음"}
                    </Text>
                    <Text style={styles.scheduleMeta} numberOfLines={1}>
                      {formatVisitTime(visit)}
                      {visit.place ? ` · ${visit.place}` : ""}
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={8}
                    style={styles.scheduleAction}
                    onPress={() => openEditSheet(visit)}
                  >
                    <EditOutlineIcon size={16} />
                  </Pressable>
                  <Pressable
                    hitSlop={8}
                    style={styles.scheduleAction}
                    onPress={() => setPendingDelete(visit)}
                  >
                    <TrashIcon size={16} />
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {isPrenatalDay && (
          <>
          {todayReport ? (
            <Pressable style={styles.reportCard} onPress={() => openReport(todayReport)}>
              <Text style={styles.reportLabel}>당일검사지</Text>
              <Text style={styles.reportDate}>{todayReport.date}</Text>
              <ChevronRightIcon size={20} />
            </Pressable>
          ) : (
            <View style={styles.reportCard}>
              <Text style={styles.reportLabelMuted}>당일검사지</Text>
              <Text style={styles.reportNote}>*진료 후 업로드됩니다</Text>
            </View>
          )}

          {previousReport ? (
            <Pressable
              style={[styles.reportCard, styles.reportCardSpacing]}
              onPress={() => openReport(previousReport)}
            >
              <Text style={styles.reportLabel}>이전검사지</Text>
              <Text style={styles.reportDate}>{previousReport.date}</Text>
              <ChevronRightIcon size={20} />
            </Pressable>
          ) : (
            <View style={[styles.reportCard, styles.reportCardSpacing]}>
              <Text style={styles.reportLabelMuted}>이전검사지</Text>
              <Text style={styles.reportNote}>*진료 후 업로드됩니다</Text>
            </View>
          )}

          {detailLoading ? (
            <View style={[styles.questionCard, styles.questionCardEmpty]}>
              <Text style={styles.questionEmptyText}>질문을 불러오는 중이에요...</Text>
            </View>
          ) : !previousReport ? (
            <View style={[styles.questionCard, styles.questionCardEmpty]}>
              <Text style={styles.questionEmptyText}>
                검사지 업로드 후 관련 질문을 확인하실 수 있습니다
              </Text>
            </View>
          ) : (
          <View style={styles.questionCard}>
            <Text style={styles.questionCardTitle}>다음 진료 때 여쭤보아요</Text>

            {suggestedQuestions.map((text, i) => (
              <View key={i} style={styles.questionRow}>
                <AiQuestionIcon />
                <Text style={styles.questionText} numberOfLines={1}>
                  {text}
                </Text>
              </View>
            ))}

            {questions.map((value, i) => (
              <TextInput
                key={i}
                style={[styles.questionInput, i > 0 && styles.questionInputSpacing]}
                placeholder="질문 입력하기"
                placeholderTextColor="#A0A0A0"
                value={value}
                onChangeText={(text) => updateQuestion(i, text)}
                onBlur={() => persistQuestions(questions)}
              />
            ))}

            {/* 마지막 칸을 채우면 아래에 질문 추가 버튼이 생긴다. */}
            {canAddMore && (
              <Pressable
                style={[styles.questionAddRow, styles.questionInputSpacing]}
                onPress={() => setQuestions((prev) => [...prev, ""])}
              >
                <PlusIcon size={24} />
              </Pressable>
            )}
          </View>
          )}
          </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={pendingDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>일정 삭제</Text>
            <Text style={styles.dialogQuestion}>이 일정을 삭제하시겠습니까?</Text>
            <Text style={styles.dialogTarget} numberOfLines={1}>
              {pendingDelete?.title || pendingDelete?.place || ""}
            </Text>
            <Text style={styles.dialogNote}>삭제한 일정은 되돌릴 수 없습니다.</Text>

            <View style={styles.dialogDivider} />
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogAction}
                onPress={() => setPendingDelete(null)}
              >
                <Text style={styles.dialogCancelText}>취소</Text>
              </Pressable>
              <View style={styles.dialogActionDivider} />
              <Pressable style={styles.dialogAction} onPress={confirmDelete}>
                <Text style={styles.dialogConfirmText}>삭제</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
header: { ...headerBar, justifyContent: "space-between", paddingHorizontal: 12 },
  headerTitle: {
    color: "#000000",
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
  doneText: {
    color: "#FA0C56",
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
  // 카드는 좌우 12, 날짜 텍스트만 16에서 시작한다 (디자인 기준)
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 46,
    paddingBottom: 24,
  },
  dateText: {
    marginLeft: 4,
    marginBottom: 12,
    color: "#414141",
    fontSize: 16,
    fontFamily: "Pretendard-Regular",
  },
  // 하루의 일정 목록 카드
  scheduleCard: {
    marginBottom: 11,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: "#FFFCFD",
    borderRadius: 14,
    boxShadow: "0 3px 3px rgba(0, 0, 0, 0.06)",
  },
  scheduleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  scheduleTitle: {
    color: "#111111",
    fontSize: 14,
    fontFamily: "Pretendard-SemiBold",
  },
  scheduleAddText: {
    color: "#FA0C56",
    fontSize: 13,
    fontFamily: "Pretendard-SemiBold",
  },
  scheduleEmptyText: {
    paddingVertical: 14,
    textAlign: "center",
    color: "#A0A0A0",
    fontSize: 13,
    fontFamily: "Pretendard-Medium",
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  scheduleRowDivider: {
    borderTopWidth: 1,
    borderTopColor: "#F5E9EE",
  },
  // 산부인과 일정은 키컬러, 그 외에는 중립색으로 한눈에 구분한다.
  scheduleTag: {
    width: 3,
    height: 28,
    borderRadius: 2,
    marginRight: 10,
  },
  scheduleTagHospital: {
    backgroundColor: "#FA0C56",
  },
  scheduleTagOther: {
    backgroundColor: "#CFCFCF",
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    color: "#111111",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  scheduleMeta: {
    marginTop: 2,
    color: "#A0A0A0",
    fontSize: 12,
    fontFamily: "Pretendard-Medium",
  },
  scheduleAction: {
    paddingHorizontal: 6,
  },
  // 삭제 확인 다이얼로그 (공유하기 다이얼로그와 같은 스타일)
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    width: 326,
    backgroundColor: "#111111",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CFCFCF",
    overflow: "hidden",
  },
  dialogTitle: {
    marginTop: 20,
    textAlign: "center",
    color: "#FFFCFD",
    fontSize: 18,
    lineHeight: 32,
    fontFamily: "Pretendard-SemiBold",
  },
  dialogQuestion: {
    marginTop: 18,
    textAlign: "center",
    color: "#FFFCFD",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Pretendard-Regular",
  },
  dialogTarget: {
    marginTop: 6,
    paddingHorizontal: 24,
    textAlign: "center",
    color: "#FF0A68",
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Pretendard-Medium",
  },
  dialogNote: {
    marginTop: 13,
    marginBottom: 20,
    textAlign: "center",
    color: "#A0A0A0",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Pretendard-Regular",
  },
  dialogDivider: {
    height: 1,
    backgroundColor: "#707070",
  },
  dialogActions: {
    flexDirection: "row",
    height: 49,
  },
  dialogAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogActionDivider: {
    width: 1,
    backgroundColor: "#707070",
  },
  dialogCancelText: {
    color: "#A0A0A0",
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "Pretendard-Medium",
  },
  dialogConfirmText: {
    color: "#FA0C56",
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "Pretendard-Medium",
  },
  reportCard: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: "#FFFCFD",
    borderRadius: 14,
    boxShadow: "0 3px 3px rgba(0, 0, 0, 0.06)",
  },
  reportCardSpacing: {
    marginTop: 11,
  },
  reportLabel: {
    flex: 1,
    color: "#111111",
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
  reportLabelMuted: {
    flex: 1,
    color: "#A0A0A0",
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
  reportNote: {
    color: "#A0A0A0",
    fontSize: 12,
    fontFamily: "Pretendard-Medium",
  },
  reportDate: {
    marginRight: 4,
    color: "#111111",
    fontSize: 16,
    fontFamily: "Pretendard-Regular",
  },
  questionCard: {
    marginTop: 12,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 18,
    backgroundColor: "#FFFCFD",
    borderRadius: 14,
    boxShadow: "0 3px 3px rgba(0, 0, 0, 0.06)",
  },
  // 아직 검사지가 없는 일정: 안내 문구만 가운데 놓는다 (디자인 높이 159)
  questionCardEmpty: {
    height: 159,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  questionEmptyText: {
    textAlign: "center",
    color: "#A0A0A0",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  questionCardTitle: {
    marginLeft: 4,
    marginBottom: 15,
    color: "#111111",
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  },
  questionText: {
    flex: 1,
    color: "#707070",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  questionInput: {
    height: 41,
    paddingHorizontal: 15,
    backgroundColor: "#FFF0F6",
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    color: "#111111",
  },
  questionInputSpacing: {
    marginTop: 6,
  },
  questionAddRow: {
    height: 41,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F6",
    borderRadius: 8,
  },
});
