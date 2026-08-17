import {
  BackChevronIcon,
  ChevronRightIcon,
  EditOutlineIcon,
  UpTriangleIcon,
} from "@/components/icons";
import { centeredContentStyle } from "@/lib/layout";
import {
  hasSeenShareTip,
  markShareTipSeen,
  PREGNANCY_LAST_WEEK,
  pregnancyWeekOf,
  startOfWeek,
} from "@/lib/pregnancy";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatVisitTime,
  getCalendarMonthMarks,
  getGuardianEmail,
  getPregnancyInfo,
  getVisits,
  type CalendarMonthMarks,
  type CalendarVisit,
  type DayMark,
  type PregnancyInfo,
} from "@/lib/api";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const EMPTY_MARKS: CalendarMonthMarks = { marks: {}, labels: {} };

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

type DayCell = {
  day: number;
  dot?: DayMark;
  appointment?: string;
} | null;

type WeekRow = { cells: DayCell[]; pregnancyWeek: number | null };

function buildMonthWeeks(
  year: number,
  month: number,
  pregnancy: PregnancyInfo | null,
  visits: CalendarVisit[],
  monthMarks: CalendarMonthMarks,
): WeekRow[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  // 등록한 일정이 있는 날은 달력에도 표시한다.
  // 산부인과 일정은 빈 원으로, 그 밖의 일정은 제목 텍스트로 보여준다.
  const monthPrefix = `${pad2(year % 100)}.${pad2(month + 1)}.`;
  const hospitalDays = new Set<number>();
  const otherVisitsByDay: Record<number, string[]> = {};
  for (const visit of visits) {
    if (!visit.date.startsWith(monthPrefix)) continue;
    const day = Number(visit.date.slice(monthPrefix.length));
    if (visit.isHospital) {
      hospitalDays.add(day);
    } else {
      const label = visit.title || visit.place;
      (otherVisitsByDay[day] ??= []).push(label);
    }
  }

  // 같은 날 일정이 여러 개면 첫 제목 뒤에 남은 개수를 덧붙인다.
  const otherDayLabels: Record<number, string> = {};
  for (const [day, labels] of Object.entries(otherVisitsByDay)) {
    otherDayLabels[Number(day)] =
      labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0];
  }

  const cells: DayCell[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    // 동그라미는 "검사지를 올린 날"(채운 점)과 "산부인과 진료가 있는 날"(빈 원)에만 찍는다.
    //
    // 서버 marks의 scheduled를 그대로 믿으면, 이비인후과처럼 산부인과가 아닌 일정에도
    // 핑크 동그라미가 찍힌다. 일정 종류는 getVisits로 이미 정확히 알고 있으므로
    // 서버 marks는 uploaded(검사지)만 신뢰하고, 진료 표시는 로컬 일정으로 판단한다.
    const uploaded = monthMarks.marks[day] === "uploaded";
    cells.push({
      day,
      dot: uploaded
        ? ("uploaded" as DayMark)
        : hospitalDays.has(day)
          ? ("scheduled" as DayMark)
          : undefined,
      // 산부인과가 아닌 일정은 동그라미 대신 제목 텍스트로 보여준다.
      appointment: otherDayLabels[day] ?? monthMarks.labels[day],
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  // 각 행의 시작일(일요일)로 주차를 계산한다.
  const firstWeekStart = startOfWeek(new Date(year, month, 1));
  const weeks: WeekRow[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const rowStart = new Date(firstWeekStart);
    rowStart.setDate(rowStart.getDate() + i);
    weeks.push({
      cells: cells.slice(i, i + 7),
      pregnancyWeek: pregnancy ? pregnancyWeekOf(rowStart, pregnancy) : null,
    });
  }
  return weeks;
}

export default function Calendar() {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calloutVisible, setCalloutVisible] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const router = useRouter();
  const [pregnancy, setPregnancy] = useState<PregnancyInfo | null>(null);
  const [upcomingVisits, setUpcomingVisits] = useState<CalendarVisit[]>([]);
  const [monthMarks, setMonthMarks] = useState<CalendarMonthMarks>(EMPTY_MARKS);
  const [guardianEmail, setGuardianEmail] = useState("");

  useFocusEffect(useCallback(() => {
    let active = true;
    getVisits().then((visits) => { if (active) setUpcomingVisits(visits); });
    return () => { active = false; };
  }, []));

  useEffect(() => {
    getPregnancyInfo().then(setPregnancy);
    getGuardianEmail().then(setGuardianEmail);
  }, []);

  // 보고 있는 달이 바뀔 때마다 그 달의 검사 기록을 받아온다.
  useEffect(() => {
    let active = true;
    getCalendarMonthMarks(monthCursor.getFullYear(), monthCursor.getMonth()).then(
      (marks) => {
        if (active) setMonthMarks(marks);
      },
    );
    return () => {
      active = false;
    };
  }, [monthCursor]);

  // 안내 말풍선은 앱을 처음 쓸 때 한 번만 보여주고 바로 본 것으로 기록한다.
  useEffect(() => {
    hasSeenShareTip().then((seen) => {
      if (seen) return;
      setCalloutVisible(true);
      markShareTipSeen();
    });
  }, []);

  const weeks = useMemo(
    () =>
      buildMonthWeeks(
        monthCursor.getFullYear(),
        monthCursor.getMonth(),
        pregnancy,
        upcomingVisits,
        monthMarks,
      ),
    [monthCursor, pregnancy, upcomingVisits, monthMarks],
  );

  // "예정된 방문"에는 지금 보고 있는 달의 산부인과 일정만 올린다.
  const monthlyHospitalVisits = useMemo(() => {
    const prefix = `${pad2(monthCursor.getFullYear() % 100)}.${pad2(monthCursor.getMonth() + 1)}.`;
    return upcomingVisits.filter(
      (visit) => visit.isHospital && visit.date.startsWith(prefix),
    );
  }, [monthCursor, upcomingVisits]);

  const goToMonth = (delta: number) => {
    setMonthCursor(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FFFCFD", "#FFEBF3"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>캘린더</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={centeredContentStyle} contentContainerStyle={styles.scrollContent}>
          {/* 안내 말풍선(디자인 y=118)은 헤더와 월 선택 줄 사이에 놓인다. */}
          <View style={styles.calloutRow}>
            {calloutVisible && (
              <View style={styles.callout}>
                <Text style={styles.calloutText}>
                  보호자에게 메일이 보내져요
                </Text>
                {/* 꼬리는 아래 공유하기 버튼 중앙을 가리킨다. */}
                <View style={styles.calloutTail} />
              </View>
            )}
          </View>

          {/* 월 선택은 좌측 정렬, 공유하기 버튼은 같은 줄 우측 (디자인 y=160/162) */}
          <View style={styles.monthRow}>
            <View style={styles.monthNav}>
              <Pressable onPress={() => goToMonth(-1)} hitSlop={8}>
                <BackChevronIcon size={24} color="#A0A0A0" />
              </Pressable>
              <Text style={styles.monthLabel}>
                {monthCursor.getFullYear()}.{" "}
                {String(monthCursor.getMonth() + 1).padStart(2, "0")}
              </Text>
              <Pressable onPress={() => goToMonth(1)} hitSlop={8}>
                <ChevronRightIcon size={24} color="#A0A0A0" />
              </Pressable>
            </View>
            <View style={styles.monthActions}>
              <Pressable
                style={styles.addScheduleButton}
                onPress={() => router.push("/calendar-time")}
              >
                <Text numberOfLines={1} style={styles.addScheduleButtonText}>
                  일정 추가
                </Text>
              </Pressable>
              <Pressable
                style={styles.shareButton}
                onPress={() => {
                  setCalloutVisible(false);
                  setShareDialogOpen(true);
                }}
              >
                <Text style={styles.shareButtonText}>공유하기</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.calendarCard}>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekdayText}>
                  {w}
                </Text>
              ))}
            </View>

            {weeks.map((week, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {week.pregnancyWeek !== null &&
                  week.pregnancyWeek >= 1 &&
                  week.pregnancyWeek <= PREGNANCY_LAST_WEEK && (
                    <Text style={styles.weekNumberLabel}>
                      {week.pregnancyWeek}주차
                    </Text>
                  )}
                <View style={styles.weekCells}>
                  {week.cells.map((cell, i) => (
                    <Pressable
                      key={i}
                      style={styles.dayCell}
                      disabled={!cell}
                      // 진료 기록이 있는 날은 상세 화면으로, 빈 날은 일정 추가 시트로.
                      onPress={() => {
                        if (!cell) return;
                        const month = pad2(monthCursor.getMonth() + 1);
                        const day = pad2(cell.day);
                        if (cell.dot || cell.appointment) {
                          router.push({
                            pathname: "/calendar/[date]",
                            params: {
                              date: `${monthCursor.getFullYear()}-${month}-${day}`,
                            },
                          });
                          return;
                        }
                        // 시트는 YY.MM.DD 형식을 기대한다.
                        const year = pad2(monthCursor.getFullYear() % 100);
                        router.push({
                          pathname: "/calendar-time",
                          params: { date: `${year}.${month}.${day}` },
                        });
                      }}
                    >
                      {cell && (
                        <>
                          <Text style={styles.dayText}>{cell.day}</Text>
                          {cell.dot === "uploaded" && (
                            <View style={styles.dayDotFilled} />
                          )}
                          {cell.dot === "scheduled" && (
                            <View style={styles.dayDotHollow} />
                          )}
                          {cell.appointment && (
                            <Text
                              style={styles.dayAppointment}
                              numberOfLines={1}
                            >
                              {cell.appointment}
                            </Text>
                          )}
                        </>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* 일정이 없는 달은 제목 없이 안내 문구만 보여준다. */}
          {monthlyHospitalVisits.length === 0 ? (
            <View style={[styles.visitsCard, styles.visitsCardEmpty]}>
              <Text style={styles.visitsEmptyText}>
                예정된 산부인과 방문 일정이 없습니다.
              </Text>
            </View>
          ) : (
          <View style={styles.visitsCard}>
            <Text style={styles.visitsTitle}>예정된 방문</Text>
            {monthlyHospitalVisits.map((visit, i) => {
              const isNext = i === 0;
              return (
                <View key={visit.id}>
                  {i > 0 && (
                    <LinearGradient
                      colors={[
                        "rgba(112,112,112,0.06)",
                        "rgba(17,17,17,0.12)",
                        "rgba(112,112,112,0.06)",
                      ]}
                      locations={[0.307, 0.5, 0.716]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.visitDivider}
                    />
                  )}
                  <Pressable
                    style={styles.visitRow}
                    // 질문 목록은 가장 가까운 다음 진료에만 열린다.
                    disabled={!isNext}
                    onPress={() => setQuestionsOpen((open) => !open)}
                  >
                    <View style={styles.visitDateCol}>
                      <Text style={styles.visitDate}>{visit.date}</Text>
                    </View>
                    <View style={styles.visitPlaceCol}>
                      <Text style={styles.visitPlace}>{visit.place}</Text>
                    </View>
                    <View style={styles.visitTimeCol}>
                      <Text style={styles.visitTime}>{formatVisitTime(visit)}</Text>
                    </View>
                    <Pressable
                      style={styles.visitEditCol}
                      hitSlop={10}
                      onPress={(event) => {
                        event.stopPropagation();
                        router.push({ pathname: "/calendar-time", params: {
                          mode: "edit", visitId: visit.id, date: visit.date,
                          title: visit.title, place: visit.place,
                          meridiem: visit.meridiem, hour: String(visit.hour), minute: String(visit.minute),
                          isHospital: String(visit.isHospital), questions: JSON.stringify(visit.questions),
                        }});
                      }}
                    >
                      <EditOutlineIcon size={16} />
                    </Pressable>
                    {isNext && (
                      <View
                        style={[
                          styles.visitMarkerCol,
                          questionsOpen && styles.visitMarkerColOpen,
                        ]}
                      >
                        <UpTriangleIcon size={14} />
                      </View>
                    )}
                  </Pressable>

                  {/* 다음 진료를 펼치면 그때 물어볼 질문 목록이 나온다. */}
                  {isNext && questionsOpen && (
                    <View style={styles.questionPanel}>
                      {visit.questions.map((question, qi) => (
                        <View key={qi} style={styles.questionRow}>
                          <Image
                            source={require("@/assets/images/AIicon.png")}
                            style={styles.questionIcon}
                            contentFit="contain"
                          />
                          <Text style={styles.questionText} numberOfLines={1}>
                            {question}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={shareDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setShareDialogOpen(false)}
      >
        <View style={styles.dialogBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>공유하기</Text>
            <Text style={styles.dialogQuestion}>
              아래 메일로 공유하시겠습니까?
            </Text>
            <Text style={styles.dialogEmail}>{guardianEmail}</Text>
            <Text style={styles.dialogNote}>
              일정공유 및 분석결과 리포트가 보내집니다.
            </Text>

            <View style={styles.dialogDivider} />
            <View style={styles.dialogActions}>
              <Pressable
                style={styles.dialogAction}
                onPress={() => setShareDialogOpen(false)}
              >
                <Text style={styles.dialogCancelText}>취소</Text>
              </Pressable>
              <View style={styles.dialogActionDivider} />
              <Pressable
                style={styles.dialogAction}
                onPress={() => setShareDialogOpen(false)}
              >
                <Text style={styles.dialogConfirmText}>확인</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  headerSpacer: {
    width: 20,
  },
  headerTitle: {
    color: "#000000",
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  // 세로 간격은 디자인 좌표(상태바 54px 제외 기준) 그대로:
  // 말풍선 64 / 월 선택 106 / 달력 카드 148 / 방문 카드 466
  calloutRow: {
    height: 27,
    marginTop: 28,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 15,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthLabel: {
    width: 79,
    textAlign: "center",
    color: "#414141",
    fontSize: 16,
    fontFamily: "Pretendard-Regular",
  },
  callout: {
    height: 27,
    justifyContent: "center",
    backgroundColor: "rgba(17,17,17,0.6)",
    borderRadius: 13.5,
    paddingHorizontal: 12,
  },
  calloutText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Pretendard-Medium",
  },
  // 말풍선 꼬리: 오른쪽 끝에서 32.5px 지점(= 공유하기 버튼 중앙)에 맞춘다.
  calloutTail: {
    position: "absolute",
    top: 27,
    right: 27,
    width: 0,
    height: 0,
    borderLeftWidth: 5.6,
    borderRightWidth: 5.6,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(17,17,17,0.6)",
  },
  monthActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addScheduleButton: {
    minWidth: 66,
    height: 28,
    backgroundColor: "#FFFCFD",
    borderWidth: 1,
    borderColor: "#FA0C56",
    borderRadius: 6,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addScheduleButtonText: {
    textAlign: "center",
    textAlignVertical: "center",
    color: "#FA0C56",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Pretendard-SemiBold",
    includeFontPadding: false,
  },
  shareButton: {
    backgroundColor: "#FA0C56",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  // 텍스트 영역 44x20 + 좌우 10 / 상하 4 패딩 (디자인 기준)
  shareButtonText: {
    width: 44,
    height: 20,
    textAlign: "center",
    textAlignVertical: "center",
    color: "#FFFCFD",
    fontSize: 12,
    lineHeight: 20,
    fontFamily: "Pretendard-SemiBold",
  },
  calendarCard: {
    backgroundColor: "#FFFCFD",
    borderRadius: 20,
    paddingTop: 18,
    paddingBottom: 11,
    marginTop: 14,
    boxShadow: "0 3px 3px rgba(0, 0, 0, 0.06)",
  },
  // 그리드는 좌측 주차 라벨(디자인 left 10) 자리를 비우고 left 54부터 시작한다.
  weekdayRow: {
    flexDirection: "row",
    paddingLeft: 54,
    paddingRight: 18,
    gap: 5,
    marginBottom: 7,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    color: "#707070",
    fontSize: 11.5,
    fontFamily: "Pretendard-Regular",
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  weekNumberLabel: {
    position: "absolute",
    left: 6,
    width: 44,
    textAlign: "center",
    color: "#FA0C56",
    fontSize: 12,
    fontFamily: "Pretendard-Medium",
  },
  weekCells: {
    flex: 1,
    flexDirection: "row",
    paddingLeft: 54,
    paddingRight: 18,
    gap: 5,
  },
  dayCell: {
    flex: 1,
    height: 51,
    borderRadius: 5.5,
    borderWidth: 0.7,
    borderColor: "#CFCFCF",
    alignItems: "center",
    paddingTop: 4,
  },
  dayText: {
    color: "#111111",
    fontSize: 12,
    fontFamily: "Pretendard-Regular",
  },
  dayDotFilled: {
    marginTop: 8,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#FA0C56",
  },
  dayDotHollow: {
    marginTop: 8,
    width: 5,
    height: 5,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: "#FA0C56",
  },
  dayAppointment: {
    marginTop: 4,
    width: 35,
    textAlign: "center",
    color: "#000000",
    fontSize: 7,
    fontFamily: "Pretendard-Regular",
  },
  visitsCard: {
    backgroundColor: "#FFFCFD",
    borderRadius: 14,
    paddingTop: 15,
    paddingBottom: 8,
    marginTop: 19,
    boxShadow: "0 3px 3px rgba(0, 0, 0, 0.06)",
  },
  visitsTitle: {
    marginLeft: 16,
    marginBottom: 15,
    color: "#111111",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  // 문구만 있는 카드 (디자인: 높이 86, 문구는 세로 가운데)
  visitsCardEmpty: {
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 0,
    paddingBottom: 0,
  },
  visitsEmptyText: {
    textAlign: "center",
    color: "#A0A0A0",
    fontSize: 14,
    lineHeight: 34,
    fontFamily: "Pretendard-Medium",
  },
  // 컬럼 위치는 Figma 361px 카드 기준 좌표를 비율로 환산한 값이라
  // 카드 폭이 달라져도 디자인과 같은 배치를 유지한다.
  // (날짜 0~85, 병원 94~177, 시간 187~270, 연필 295~311)
  visitRow: {
    height: 34,
  },
  visitDateCol: {
    position: "absolute",
    left: 0,
    width: "23.55%",
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  visitPlaceCol: {
    position: "absolute",
    left: "26.04%",
    width: "22.99%",
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  visitTimeCol: {
    position: "absolute",
    left: "51.80%",
    width: "22.99%",
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  visitEditCol: {
    position: "absolute",
    left: "81.72%",
    width: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  visitMarkerCol: {
    position: "absolute",
    left: "90%",
    width: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  // 질문 목록이 열리면 화살표가 아래를 가리킨다.
  visitMarkerColOpen: {
    transform: [{ rotate: "180deg" }],
  },
  visitDate: {
    textAlign: "center",
    color: "#111111",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Pretendard-Regular",
  },
  visitPlace: {
    textAlign: "center",
    color: "#707070",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  visitTime: {
    textAlign: "center",
    color: "#111111",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  visitDivider: {
    height: 1,
    marginHorizontal: "7%",
  },
  // 디자인 기준(361px 카드): left 16 / width 325 / height 73,
  // 행 위 3px·아래 14px 간격, 안쪽 좌우 10px.
  questionPanel: {
    marginLeft: 16,
    marginRight: 20,
    marginTop: 3,
    marginBottom: 14,
    paddingTop: 19,
    paddingBottom: 16,
    paddingHorizontal: 10,
    backgroundColor: "#FFF0F6",
    borderRadius: 16,
    gap: 5,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  questionIcon: {
    width: 16,
    height: 16,
  },
  questionText: {
    flex: 1,
    color: "#A0A0A0",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  // 공유하기 확인 다이얼로그 (디자인: 326x218 다크 카드)
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    // 326 고정 대신 화면 폭 대비 85%로 잡아서, 아주 좁은 화면(구형 기기 등)에서도
    // 좌우 여백 없이 잘리지 않는다. maxWidth로 큰 화면에서 과하게 커지는 것도 막는다.
    width: "85%",
    maxWidth: 326,
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
    marginTop: 22,
    textAlign: "center",
    color: "#FFFCFD",
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Pretendard-Regular",
  },
  dialogEmail: {
    marginTop: 6,
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
});
