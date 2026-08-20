import {
  BackChevronIcon,
  ChevronRightIcon,
  CloseIcon,
  XXLogoIcon,
} from "@/components/icons";
import { centeredContentStyle, centeredSheetStyle } from "@/lib/layout";
import { parseTestReport } from "@/lib/ocr";
import { setPendingScan, type ParsedTestItem } from "@/lib/report";
import { scanDocumentImage } from "@/lib/scan";
import { currentPregnancyWeek } from "@/lib/pregnancy";
import { colors, font, headerBar, radius, tracking, type as t } from "@/lib/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BAR_WIDTHS = [100.8, 100.8, 83.2, 73.6];

/** 연도 선택 목록. 오래된 검사지도 올릴 수 있게 과거를 넉넉히 둔다. */
const YEAR_OPTIONS = (() => {
  const thisYear = new Date().getFullYear();
  const years: number[] = [];
  for (let year = thisYear; year >= thisYear - 20; year--) years.push(year);
  return years;
})();

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** 저장용 "YY.MM.DD" 문자열 (calendar-visits 등 앱 전반의 날짜 표기와 통일). */
function toStoredDate(value: Date) {
  return `${pad(value.getFullYear() % 100)}.${pad(value.getMonth() + 1)}.${pad(value.getDate())}`;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  // 연도+월 옆 화살표를 누르면 열리는 연도 목록.
  //
  // 예전에는 화살표가 아무 동작도 하지 않았고 월 이동(‹ ›)만 있었다. 지난해나
  // 그 전 검사지를 올릴 때 월 단위로만 움직이면 수십 번을 눌러야 해서,
  // 연도를 바로 고를 수 있게 했다.
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 550,
          useNativeDriver: true,
        }),
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
        // 임신 주수를 함께 넘겨야 판정 엔진이 삼분기별 기준을 적용할 수 있다.
        // (헤모글로빈 1분기 11.0 / 2분기 10.5 / 3분기 11.0 등)
        //
        // 다만 검사일은 이 OCR이 읽어내야 알 수 있어서, 여기서는 오늘 기준의
        // 임시값을 쓴다. 사용자가 날짜를 확정하면 다음 화면(analyzing.tsx)이
        // 그 날짜의 주차로 다시 판정한다.
        const provisionalWeek = await currentPregnancyWeek();
        const result = await parseTestReport(resolvedUri, {
          gestationalWeek: provisionalWeek,
        });
        if (cancelled) return;
        setItems(result.items);
        const parsedDate = parseReportDate(result.reportDate);
        if (parsedDate) {
          setSelectedDate(parsedDate);
          setCalendarMonth(
            new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1),
          );
        }
      } catch (error) {
        console.warn("[scan] 검사지 OCR 파싱 실패:", error);
        if (cancelled) return;
        setItems(undefined);
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
    setPendingScan({
      uri: finalUri,
      items,
      testDate: toStoredDate(selectedDate),
    });
    router.push({
      pathname: "/(modals)/scan/analyzing",
      params: { uri: finalUri },
    });
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FFFCFD", "#FFEBF3"]}
        style={StyleSheet.absoluteFill}
      />
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
            <Text style={styles.loadingText}>
              검사지에서{"\n"}검사 날짜를 찾는 중이에요
            </Text>
            <View style={styles.bars}>
              {BAR_WIDTHS.map((width, index) => (
                <Animated.View
                  key={index}
                  style={[styles.bar, { width, opacity: pulse }]}
                />
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={[centeredContentStyle, styles.content]}>
              <XXLogoIcon />
              <Text style={styles.heading}>검사 날짜를{"\n"}확인해주세요</Text>

              {/* Figma 911:4419 — "날짜" 라벨 + 값 칩 한 줄.
                  편집(연필) 아이콘 없이 줄 전체를 누르면 아래 데이트피커가 열린다. */}
              <Pressable
                style={styles.dateField}
                onPress={() => setPickerOpen((open) => !open)}
              >
                <Text style={styles.dateLabel}>날짜</Text>
                <View style={styles.dateChip}>
                  <Text style={styles.dateChipText}>
                    {selectedDate ? toStoredDate(selectedDate) : ""}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* 완료(다음) 버튼은 항상 화면 하단에 붙는다. */}
            <View style={[centeredSheetStyle, styles.bottomArea]}>
              {/* Figma 911:4480 — 날짜를 아직 못 정했을 때만 뜨는 안내 토스트 */}
              {!selectedDate && (
                <View style={styles.toast}>
                  <Text style={styles.toastText}>
                    검사지에서 날짜를 파악하지 못했어요 날짜를 직접선택해주세요
                  </Text>
                </View>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  !selectedDate && styles.confirmButtonDisabled,
                  pressed && selectedDate && styles.pressed,
                ]}
                disabled={!selectedDate}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>다음</Text>
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>

      {/* Figma 911:4481 "팝업3" — 화면 하단에 붙는 날짜 선택 시트.
          요일 헤더 없이 날짜 그리드만 두고, 시트 바깥을 누르면 닫힌다. */}
      {!loading && pickerOpen && (
        <View style={styles.pickerLayer} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPickerOpen(false)}
          />
          <View style={[centeredSheetStyle, styles.pickerSheet]}>
            <SafeAreaView edges={["bottom"]}>
              <View style={styles.pickerHeader}>
                <Pressable
                  style={styles.pickerMonthRow}
                  hitSlop={8}
                  onPress={() => setYearPickerOpen((open) => !open)}
                >
                  <Text style={styles.pickerMonth}>
                    {calendarMonth.getFullYear()}년{" "}
                    {calendarMonth.getMonth() + 1}월
                  </Text>
                  <View style={yearPickerOpen ? styles.pickerMonthChevronOpen : undefined}>
                    <ChevronRightIcon size={16} color="#111111" />
                  </View>
                </Pressable>
                <View style={styles.pickerNav}>
                  <Pressable
                    hitSlop={10}
                    onPress={() =>
                      setCalendarMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() - 1,
                            1,
                          ),
                      )
                    }
                  >
                    <View style={styles.pickerNavPrev}>
                      <ChevronRightIcon size={22} color="#A0A0A0" />
                    </View>
                  </Pressable>
                  <Pressable
                    hitSlop={10}
                    onPress={() =>
                      setCalendarMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() + 1,
                            1,
                          ),
                      )
                    }
                  >
                    <ChevronRightIcon size={22} color="#A0A0A0" />
                  </Pressable>
                </View>
              </View>

              {yearPickerOpen && (
                <ScrollView style={styles.yearList} nestedScrollEnabled>
                  {YEAR_OPTIONS.map((year) => {
                    const selected = year === calendarMonth.getFullYear();
                    return (
                      <Pressable
                        key={year}
                        style={styles.yearOption}
                        onPress={() => {
                          setCalendarMonth(
                            (current) => new Date(year, current.getMonth(), 1),
                          );
                          setYearPickerOpen(false);
                        }}
                      >
                        <Text
                          style={[styles.yearText, selected && styles.yearTextSelected]}
                        >
                          {year}년
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.pickerGrid}>
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
                      style={styles.pickerDayCell}
                      onPress={() => {
                        if (day == null) return;
                        setSelectedDate(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth(),
                            day,
                          ),
                        );
                        setPickerOpen(false);
                      }}
                    >
                      {day != null && (
                        <View
                          style={[
                            styles.pickerDay,
                            selected && styles.pickerDaySelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.pickerDayText,
                              isToday && styles.pickerDayTextToday,
                              selected && styles.pickerDayTextSelected,
                            ]}
                          >
                            {day}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </SafeAreaView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
header: { ...headerBar, justifyContent: "space-between", paddingHorizontal: 16 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 48,
  },
  loadingText: {
    fontFamily: font.medium,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: tracking(14),
    color: colors.textHint,
    textAlign: "center",
  },
  bars: { width: 100.8, gap: 4.8, alignItems: "flex-start" },
  bar: { height: 3.2, borderRadius: 220, backgroundColor: colors.brandStrong },
  content: { paddingHorizontal: 16, paddingTop: 24, gap: 12 },
  // Figma 911:4743 — 24/32, 자간 -0.72, 2줄 68px.
  heading: { marginTop: -8, marginBottom: 4, minHeight: 64, ...t.heading24, letterSpacing: tracking(24) },

  // Figma 911:4419 — 361x50 / radius 8 / secondary_pink / base shadow
  dateField: {
    marginTop: 8,
    height: 50,
    paddingLeft: 15,
    paddingRight: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surfacePink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 3px 3px rgba(0, 0, 0, 0.06)",
  },
  dateLabel: {
    fontFamily: font.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: tracking(14),
    color: colors.textHint,
  },
  // Figma 911:4422 — 80x30 흰 칩. 값이 없으면 빈 칩만 보인다.
  dateChip: {
    width: 80,
    height: 30,
    borderRadius: radius.tile,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  // Figma 911:4752 — 날짜 값만 자간이 -0.14로 따로 지정돼 있다(본문 -3% 규칙 예외).
  dateChipText: {
    fontFamily: font.medium,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.14,
    color: colors.text,
  },

  bottomArea: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  // Figma 911:4480 — 309x36 / rgba(17,17,17,0.8) / radius 6
  toast: {
    alignSelf: "center",
    minHeight: 36,
    maxWidth: 320,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: "rgba(17,17,17,0.8)",
    justifyContent: "center",
  },
  toastText: {
    textAlign: "center",
    color: "#FFFDF9",
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 22,
    letterSpacing: tracking(12),
  },
  pressed: { opacity: 0.78 },
  // Figma 911:4396 / 911:4474 — 361x46 / radius 12 / 활성 #FA0C56, 비활성 #A0A0A0
  confirmButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.brandStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonDisabled: { backgroundColor: colors.textHint },
  // 버튼 글자만 자간이 양수(+1.2)다 — 본문 -3% 규칙의 예외.
  confirmButtonText: {
    color: "#FFFDF9",
    fontFamily: font.semiBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 1.2,
  },

  // Figma 911:4481 "팝업3" — 하단에 붙는 날짜 선택 시트
  pickerLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#FFFCFD",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#CFCFCF",
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 8,
    boxShadow: "0 -4px 4px rgba(0, 0, 0, 0.15)",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pickerMonthRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  pickerMonth: {
    color: "#111111",
    fontFamily: "Pretendard-SemiBold",
    fontSize: 15.4,
    lineHeight: 22,
  },
  pickerMonthChevronOpen: { transform: [{ rotate: "90deg" }] },
  // 검사지가 몇 해 전 것일 수도 있어 목록을 넉넉히 두고 스크롤한다.
  yearList: { maxHeight: 168, marginBottom: 8 },
  yearOption: { height: 42, justifyContent: "center", paddingHorizontal: 4 },
  yearText: {
    color: "#707070",
    fontFamily: "Pretendard-Medium",
    fontSize: 15,
  },
  yearTextSelected: { color: "#FA0C56", fontFamily: "Pretendard-SemiBold" },
  pickerNav: { flexDirection: "row", alignItems: "center", gap: 22 },
  pickerNavPrev: { transform: [{ rotate: "180deg" }] },
  // 요일 헤더 없이 날짜만 7열로 깐다(디자인 911:4657).
  pickerGrid: { flexDirection: "row", flexWrap: "wrap" },
  pickerDayCell: {
    width: "14.2857%",
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerDay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerDaySelected: { backgroundColor: "#FFF0F6" },
  pickerDayText: {
    color: "#111111",
    fontFamily: "Pretendard-Regular",
    fontSize: 16.4,
    lineHeight: 20,
  },
  pickerDayTextToday: { color: "#FF0A68", fontFamily: "Pretendard-SemiBold" },
  pickerDayTextSelected: {
    color: "#FF0A68",
    fontFamily: "Pretendard-SemiBold",
  },
});
