import { BackChevronIcon, CloseIcon, EditOutlineIcon, XXLogoIcon } from "@/components/icons";
import { centeredContentStyle, centeredSheetStyle } from "@/lib/layout";
import { setPendingScan, type ParsedTestItem } from "@/lib/report";
import { parseTestReport } from "@/lib/ocr";
import { scanDocumentImage } from "@/lib/scan";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BAR_WIDTHS = [100.8, 100.8, 83.2, 73.6];
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** 저장용 "YY.MM.DD" 문자열 (calendar-visits 등 앱 전반의 날짜 표기와 통일). */
function toStoredDate(value: Date) {
  return `${pad(value.getFullYear() % 100)}.${pad(value.getMonth() + 1)}.${pad(value.getDate())}`;
}

/** 화면에 보여줄 "3월 23일 (토)" 형태. */
function toDisplayDate(value: Date) {
  return `${value.getMonth() + 1}월 ${value.getDate()}일 (${WEEKDAY_LABELS[value.getDay()]})`;
}

/** OCR이 돌려준 "YYYY-MM-DD"를 Date로. 형식이 안 맞으면 null. */
function parseReportDate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Figma(837:5... 날짜 확인 — "3월 23일 토 [수정]" 톤 참고): scan/index.tsx에서
// 사진을 고르면 이 화면으로 넘어와, 여기서 실제로 scanDocumentImage(lib/scan.ts)로
// 사진을 정리하고 parseTestReport(lib/ocr.ts)로 검사항목·검사일을 OCR로 읽는다.
// 검사일을 찾으면 그 날짜를 보여주고 "수정"으로 고칠 수 있게 하고, 못 찾으면
// (추측한 날짜를 기본값으로 채우지 않고) 날짜를 못 찾았다고 알린 뒤 달력에서
// 직접 고르게 한다. "다음"을 누르면 스캔·OCR 결과 전체를 setPendingScan으로
// 넘겨서 scan/analyzing.tsx가 다시 파싱하지 않고 바로 저장 단계로 넘어가게 한다.
export default function ScanDateConfirm() {
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const pulse = useRef(new Animated.Value(0.4)).current;

  const [loading, setLoading] = useState(true);
  const [finalUri, setFinalUri] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedTestItem[] | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateFound, setDateFound] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();

    if (!uri) {
      loop.stop();
      Alert.alert("사진을 찾을 수 없어요", "다시 시도해주세요.");
      router.back();
      return () => loop.stop();
    }

    let cancelled = false;

    (async () => {
      let resolvedUri = uri;
      try {
        resolvedUri = await scanDocumentImage(uri);
      } catch {
        resolvedUri = uri;
      }
      if (cancelled) return;
      setFinalUri(resolvedUri);

      try {
        const result = await parseTestReport(resolvedUri);
        if (cancelled) return;
        setItems(result.items);
        const parsedDate = parseReportDate(result.reportDate);
        if (parsedDate) {
          setSelectedDate(parsedDate);
          setCalendarMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
          setDateFound(true);
        } else {
          setDateFound(false);
        }
      } catch (error) {
        console.warn("[scan] 검사지 OCR 파싱 실패:", error);
        if (cancelled) return;
        setItems(undefined);
        setDateFound(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  // 날짜를 못 찾았으면, 로딩이 끝나자마자 바로 달력을 열어서 직접 고르게 한다.
  useEffect(() => {
    if (!loading && !dateFound) setPickerOpen(true);
  }, [loading, dateFound]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: days }, (_, index) => index + 1),
    ];
  }, [calendarMonth]);

  function handleBack() {
    router.back();
  }

  function handleConfirm() {
    if (!finalUri || !selectedDate) return;
    setPendingScan({ uri: finalUri, items, testDate: toStoredDate(selectedDate) });
    router.push({ pathname: "/(modals)/scan/analyzing", params: { uri: finalUri } });
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={handleBack}>
            <BackChevronIcon size={24} />
          </Pressable>
          <Pressable hitSlop={8} onPress={handleBack}>
            <CloseIcon size={24} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <Text style={styles.loadingText}>검사지에서{"\n"}검사 날짜를 찾는 중이에요</Text>
            <View style={styles.bars}>
              {BAR_WIDTHS.map((width, index) => (
                <Animated.View key={index} style={[styles.bar, { width, opacity: pulse }]} />
              ))}
            </View>
          </View>
        ) : (
          <View style={[centeredContentStyle, styles.content]}>
            <XXLogoIcon width={65} />
            <Text style={styles.heading}>검사 날짜를{"\n"}확인해주세요</Text>

            {!dateFound && (
              <Text style={styles.notice}>사진에서 검사 날짜를 찾지 못했어요.{"\n"}아래에서 직접 선택해주세요.</Text>
            )}

            <Pressable style={styles.dateField} onPress={() => setPickerOpen((open) => !open)}>
              <Text style={styles.dateLabel}>검사 날짜</Text>
              <View style={styles.dateValueRow}>
                <Text style={[styles.dateValue, !selectedDate && styles.dateValuePlaceholder]}>
                  {selectedDate ? toDisplayDate(selectedDate) : "날짜 선택"}
                </Text>
                <EditOutlineIcon size={16} />
              </View>
            </Pressable>

            {pickerOpen && (
              <View style={styles.calendarCard}>
                <View style={styles.calendarHeader}>
                  <Text style={styles.calendarTitle}>
                    {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
                  </Text>
                  <View style={styles.calendarActions}>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                      }
                    >
                      <Text style={styles.calendarArrow}>‹</Text>
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                      }
                    >
                      <Text style={styles.calendarArrow}>›</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.calendarGrid}>
                  {calendarCells.map((day, index) => {
                    const selected =
                      selectedDate != null &&
                      day === selectedDate.getDate() &&
                      calendarMonth.getMonth() === selectedDate.getMonth() &&
                      calendarMonth.getFullYear() === selectedDate.getFullYear();
                    const isToday =
                      day === today.getDate() &&
                      calendarMonth.getMonth() === today.getMonth() &&
                      calendarMonth.getFullYear() === today.getFullYear();
                    return (
                      <Pressable
                        key={`${index}-${day ?? "empty"}`}
                        disabled={day == null}
                        style={[styles.calendarDay, selected && styles.calendarDaySelected]}
                        onPress={() => {
                          if (day == null) return;
                          setSelectedDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
                          setDateFound(true);
                          setPickerOpen(false);
                        }}
                      >
                        {day != null && (
                          <Text
                            style={[
                              styles.calendarDayText,
                              isToday && styles.calendarDayTextToday,
                              selected && styles.calendarDayTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {!loading && (
          <Pressable
            style={({ pressed }) => [
              centeredSheetStyle,
              styles.confirmButton,
              !selectedDate && styles.confirmButtonDisabled,
              pressed && selectedDate && styles.pressed,
            ]}
            disabled={!selectedDate}
            onPress={handleConfirm}
          >
            <Text style={styles.confirmButtonText}>다음</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  );
}

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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 48 },
  loadingText: { color: "#A0A0A0", fontFamily: "Pretendard-Medium", fontSize: 14, lineHeight: 22, textAlign: "center" },
  bars: { width: 100.8, gap: 4.8, alignItems: "flex-start" },
  bar: { height: 3.2, borderRadius: 220, backgroundColor: "#FA0C56" },
  content: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  heading: { marginTop: -8, marginBottom: 4, color: "#4C4C4C", fontFamily: "Pretendard-SemiBold", fontSize: 24, lineHeight: 32 },
  notice: { color: "#FA0C56", fontFamily: "Pretendard-Medium", fontSize: 13, lineHeight: 20 },
  dateField: {
    marginTop: 8,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFF0F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateLabel: { color: "#A0A0A0", fontFamily: "Pretendard-Medium", fontSize: 14 },
  dateValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateValue: { color: "#111111", fontFamily: "Pretendard-SemiBold", fontSize: 16 },
  dateValuePlaceholder: { color: "#A0A0A0", fontFamily: "Pretendard-Medium" },
  calendarCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFCFD",
    boxShadow: "0 0 8px rgba(0, 0, 0, 0.08)",
  },
  calendarHeader: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarTitle: { color: "#111111", fontSize: 15.4, lineHeight: 22, fontFamily: "Pretendard-SemiBold" },
  calendarActions: { flexDirection: "row", alignItems: "center", gap: 24 },
  calendarArrow: { color: "#A0A0A0", fontSize: 28, lineHeight: 28, fontFamily: "Pretendard-Medium" },
  calendarGrid: { marginTop: 8, flexDirection: "row", flexWrap: "wrap" },
  calendarDay: { width: "14.2857%", height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21 },
  calendarDaySelected: { backgroundColor: "#FFF0F6" },
  calendarDayText: { color: "#111111", fontSize: 16, lineHeight: 22, fontFamily: "Pretendard-Regular" },
  calendarDayTextToday: { color: "#FA0C56", fontFamily: "Pretendard-SemiBold" },
  calendarDayTextSelected: { color: "#FF0A68", fontSize: 18.5, lineHeight: 24 },
  pressed: { opacity: 0.78 },
  confirmButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#FA0C56",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDisabled: { backgroundColor: "#F0A9C2" },
  confirmButtonText: { color: "#FFFDF9", fontFamily: "Pretendard-SemiBold", fontSize: 20, letterSpacing: 1.2 },
});
