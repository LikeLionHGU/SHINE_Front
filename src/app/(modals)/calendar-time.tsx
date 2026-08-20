import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ToggleSwitch } from "@/components/icons";
import { getVisits, saveVisit } from "@/lib/api";
import { centeredSheetStyle } from "@/lib/layout";

/** 휠에는 AM/PM으로 표기하고, 화면 상단 요약에는 오전/오후로 보여준다. */
const MERIDIEMS = ["AM", "PM"];
const MERIDIEM_LABELS = ["오전", "오후"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** 휠 한 칸 높이. 선택 밴드와 스냅 간격이 이 값을 공유한다. */
const ITEM_HEIGHT = 28;
// 7줄이면 카드 높이가 화면에 남은 공간을 넘어서 휠 위아래가 잘렸다.
// 5줄이면 선택 밴드 위아래로 두 칸씩 보여 굴리는 느낌은 그대로다.
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

/** 피커 카드가 아래에서 올라올 때의 이동 거리 */
const PICKER_SLIDE_DISTANCE = 320;

/** 시트가 차지하는 화면 비율. 열릴 때 이 높이만큼 아래에서 올라온다. */
const SHEET_HEIGHT_RATIO = 0.73;

/** 제목/장소 입력 한 줄 높이. 장소 추천 목록을 그 아래에 붙일 때 쓴다. */
const FIELD_HEIGHT = 41;
/** 제목 + 구분선 + 장소 = 입력 덩어리 전체 높이. */
const FIELD_GROUP_HEIGHT = FIELD_HEIGHT * 2 + 1;
/** 한 번에 보여줄 장소 추천 개수. 너무 많으면 아래 입력들을 다 덮는다. */
const PLACE_SUGGESTION_LIMIT = 5;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** "YY.MM.DD" → Date. 형식이 어긋나면 오늘 날짜로 둔다. */
function parseVisitDate(value: string) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return new Date();
  const [year, month, day] = parts;
  return new Date(2000 + year, month - 1, day);
}

function formatVisitDate(value: Date) {
  return `${pad(value.getFullYear() % 100)}.${pad(value.getMonth() + 1)}.${pad(value.getDate())}`;
}

/** 한 칸씩 스냅되는 세로 휠. 가운데 칸이 선택 값이 된다. */
function WheelColumn({
  data,
  selectedIndex,
  onSelect,
  width,
}: {
  data: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
}) {
  const ref = useRef<ScrollView>(null);

  // contentOffset은 iOS 전용이라, 처음 그려질 때 선택 값 위치로 직접 맞춘다.
  useEffect(() => {
    ref.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    // 최초 1회만 맞추고, 이후에는 사용자의 스크롤을 방해하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(data.length - 1, index));
    if (clamped !== selectedIndex) onSelect(clamped);
  };

  return (
    <ScrollView
      ref={ref}
      style={{ width, height: WHEEL_HEIGHT }}
      contentContainerStyle={{
        paddingVertical: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
      }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
      onMomentumScrollEnd={handleMomentumEnd}
    >
      {data.map((label, i) => {
        // 선택 칸에서 멀어질수록 흐려지는 휠 효과
        const distance = Math.abs(i - selectedIndex);
        const selected = distance === 0;
        return (
          <Pressable
            key={label}
            style={[styles.wheelItem, { opacity: Math.max(0.18, 1 - distance * 0.3) }]}
            onPress={() => {
              onSelect(i);
              ref.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
            }}
          >
            <Text style={[styles.wheelText, selected && styles.wheelTextSelected]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Figma: 캘린더_시간
// 일정 추가/수정 바텀시트. 제목·장소·시간·병원 여부를 입력한다.
export default function CalendarTimePicker() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; mode?: string; visitId?: string; title?: string; place?: string; meridiem?: string; hour?: string; minute?: string; isHospital?: string; questions?: string }>();
  // 날짜 칸을 눌러 들어오면 그 날짜가 채워지고,
  // "일정 추가" 버튼으로 들어오면 비어 있는 상태에서 직접 고른다.
  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    params.date ? parseVisitDate(params.date) : null,
  );
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const base = params.date ? parseVisitDate(params.date) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const date = selectedDate ? formatVisitDate(selectedDate) : "";

  const [title, setTitle] = useState(params.title ?? "");
  const [place, setPlace] = useState(params.place ?? "");
  // 지금까지 등록한 일정의 장소들. 같은 산부인과를 반복해서 가는 경우가
  // 대부분이라, 매번 새로 타이핑하지 않고 골라 넣을 수 있게 한다.
  const [pastPlaces, setPastPlaces] = useState<string[]>([]);
  const [placeSuggestOpen, setPlaceSuggestOpen] = useState(false);
  const [isHospital, setIsHospital] = useState(params.isHospital !== "false");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // 시간 피커는 "시간" 행 바로 아래에 붙어 시트 바닥까지 채운다.
  const today = useMemo(() => new Date(), []);

  // 최근에 간 곳이 위로 오도록 날짜 내림차순으로 정렬한 뒤 중복을 없앤다.
  // ("YY.MM.DD" 형식이라 문자열 비교만으로 날짜순이 된다.)
  useEffect(() => {
    let active = true;
    getVisits().then((visits) => {
      if (!active) return;
      const seen = new Set<string>();
      const places: string[] = [];
      for (const visit of [...visits].sort((a, b) => b.date.localeCompare(a.date))) {
        const value = visit.place?.trim();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        places.push(value);
      }
      setPastPlaces(places);
    });
    return () => {
      active = false;
    };
  }, []);

  // 입력한 글자가 있으면 그걸로 걸러내고, 비어 있으면 최근 장소를 그대로 보여준다.
  // 이미 정확히 같은 값이 들어가 있으면 고를 게 없으므로 목록을 닫는다.
  const placeSuggestions = useMemo(() => {
    const query = place.trim().toLowerCase();
    return pastPlaces
      .filter((item) => item.toLowerCase() !== query)
      .filter((item) => !query || item.toLowerCase().includes(query))
      .slice(0, PLACE_SUGGESTION_LIMIT);
  }, [pastPlaces, place]);

  const [meridiemIndex, setMeridiemIndex] = useState(params.meridiem === "AM" ? 0 : 1);
  const [hourIndex, setHourIndex] = useState(Math.max(0, HOURS.indexOf(Number(params.hour ?? 3))));
  const [minuteIndex, setMinuteIndex] = useState(Math.max(0, MINUTES.indexOf(Number(params.minute ?? 0))));

  const timeLabel = useMemo(
    () =>
      `${MERIDIEM_LABELS[meridiemIndex]} ${HOURS[hourIndex]}:${pad(MINUTES[minuteIndex])}`,
    [meridiemIndex, hourIndex, minuteIndex]
  );

  // 피커 카드는 시트처럼 아래에서 밀려 올라온다.
  // 닫힐 때도 애니메이션을 보여주려고 사라지는 시점을 따로 관리한다.
  const slide = useRef(new Animated.Value(0)).current;
  const [pickerMounted, setPickerMounted] = useState(false);

  useEffect(() => {
    if (pickerOpen || datePickerOpen) {
      setPickerMounted(true);
      Animated.timing(slide, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.timing(slide, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPickerMounted(false);
    });
  }, [datePickerOpen, pickerOpen, slide]);

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

  // 시트는 열릴 때 아래에서 올라오고, 배경은 부드럽게 어두워진다.
  const enter = useRef(new Animated.Value(0)).current;
  const { height: screenHeight } = useWindowDimensions();

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  /** 닫힘 애니메이션을 보여준 뒤에 실제로 화면을 닫는다. */
  const closeSheet = () => {
    Animated.timing(enter, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) router.back();
    });
  };

  const saveAndClose = async () => {
    // 날짜 없이 저장하면 어디에도 안 보이므로, 먼저 날짜를 고르게 한다.
    if (!selectedDate) {
      setPickerOpen(false);
      setDatePickerOpen(true);
      return;
    }
    let questions: string[] = [];
    try { questions = params.questions ? JSON.parse(params.questions) : []; } catch { questions = []; }
    await saveVisit({
      id: params.visitId ?? `visit-${Date.now()}`,
      date,
      title,
      place,
      meridiem: meridiemIndex === 0 ? "AM" : "PM",
      hour: HOURS[hourIndex],
      minute: MINUTES[minuteIndex],
      isHospital,
      questions,
    });
    closeSheet();
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, { opacity: enter }]} />
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenHeight * SHEET_HEIGHT_RATIO, 0],
                }),
              },
            ],
          },
        ]}
      >
        <SafeAreaView edges={["bottom"]} style={styles.sheetContent}>
          <View style={styles.header}>
            <Pressable onPress={closeSheet} hitSlop={8}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Text style={styles.dateTitle}>{params.mode === "edit" ? "일정 수정" : "일정 추가"}</Text>
            <Pressable onPress={saveAndClose} hitSlop={8}>
              <Text style={styles.addText}>완료</Text>
            </Pressable>
          </View>

        <Pressable
          style={styles.dateField}
          onPress={() => {
            setPlaceSuggestOpen(false);
            setPickerOpen(false);
            setDatePickerOpen((open) => !open);
          }}
        >
          <Text style={styles.optionLabel}>날짜</Text>
          <View style={styles.dateChip}><Text style={styles.timeChipText}>{date}</Text></View>
        </Pressable>

        {/* 추천 목록이 아래 입력들 위로 떠야 해서 감싸는 View에 zIndex를 준다. */}
        <View style={styles.fieldGroupWrap}>
          <View style={styles.fieldGroup}>
            <TextInput
              style={[styles.field, styles.fieldTop]}
              placeholder="제목"
              placeholderTextColor="#A0A0A0"
              value={title}
              onChangeText={setTitle}
              onFocus={() => setPlaceSuggestOpen(false)}
            />
            <View style={styles.fieldSeparator} />
            <TextInput
              style={[styles.field, styles.fieldBottom]}
              placeholder="장소 또는 위치"
              placeholderTextColor="#A0A0A0"
              value={place}
              onChangeText={(text) => {
                setPlace(text);
                setPlaceSuggestOpen(true);
              }}
              onFocus={() => {
                setPickerOpen(false);
                setDatePickerOpen(false);
                setPlaceSuggestOpen(true);
              }}
            />
          </View>

          {/* onBlur로 닫으면 항목을 누르는 순간 목록이 먼저 사라져 터치를
              놓친다 — 고르거나 다른 곳을 눌렀을 때만 닫는다. */}
          {placeSuggestOpen && placeSuggestions.length > 0 && (
            <View style={styles.placeSuggestions}>
              <Text style={styles.placeSuggestionsHint}>최근 등록한 장소</Text>
              {placeSuggestions.map((item, index) => (
                <Pressable
                  key={item}
                  style={[
                    styles.placeSuggestionRow,
                    index < placeSuggestions.length - 1 && styles.placeSuggestionDivider,
                  ]}
                  onPress={() => {
                    setPlace(item);
                    setPlaceSuggestOpen(false);
                  }}
                >
                  <Text style={styles.placeSuggestionText} numberOfLines={1}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.optionCard}>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>시간</Text>
            <Pressable
              style={styles.timeChip}
              onPress={() => {
                setPlaceSuggestOpen(false);
                setDatePickerOpen(false);
                setPickerOpen((open) => !open);
              }}
            >
              <Text style={styles.timeChipText}>{timeLabel}</Text>
            </Pressable>
          </View>
          <View style={styles.optionDivider} />
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>산부인과</Text>
            <ToggleSwitch value={isHospital} onValueChange={setIsHospital} />
          </View>
        </View>

        {/* 피커는 아래쪽 입력들을 덮으므로, 가려진 곳을 누르면 닫히게 한다. */}
        {pickerMounted && (
          <Pressable
            style={styles.pickerDismissArea}
            onPress={() => {
              setPickerOpen(false);
              setDatePickerOpen(false);
            }}
          />
        )}

        {pickerMounted && datePickerOpen && (
          <Animated.View
            style={[
              styles.datePickerCard,
              {
                opacity: slide,
                transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [PICKER_SLIDE_DISTANCE, 0] }) }],
              },
            ]}
          >
            <View style={styles.calendarPickerHeader}>
              <Text style={styles.calendarPickerTitle}>
                {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
              </Text>
              <View style={styles.calendarPickerActions}>
                <Pressable hitSlop={8} onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                  <Text style={styles.calendarPickerArrow}>‹</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                  <Text style={styles.calendarPickerArrow}>›</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.calendarPickerGrid}>
              {calendarCells.map((day, index) => {
                const selected =
                  selectedDate != null &&
                  day === selectedDate.getDate() &&
                  calendarMonth.getMonth() === selectedDate.getMonth() &&
                  calendarMonth.getFullYear() === selectedDate.getFullYear();
                // 오늘은 키컬러로, 선택하려는 날짜는 원으로 표시한다.
                const isToday =
                  day === today.getDate() &&
                  calendarMonth.getMonth() === today.getMonth() &&
                  calendarMonth.getFullYear() === today.getFullYear();
                return (
                  <Pressable
                    key={`${index}-${day ?? "empty"}`}
                    disabled={day == null}
                    style={[styles.calendarPickerDay, selected && styles.calendarPickerDaySelected]}
                    onPress={() => {
                      if (day == null) return;
                      setSelectedDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
                      setDatePickerOpen(false);
                    }}
                  >
                    {day != null && (
                      <Text
                        style={[
                          styles.calendarPickerDayText,
                          isToday && styles.calendarPickerDayTextToday,
                          selected && styles.calendarPickerDayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}

        {pickerMounted && pickerOpen && (
          <Animated.View
            style={[
              styles.pickerCard,
              {
                opacity: slide,
                transform: [
                  {
                    translateY: slide.interpolate({
                      inputRange: [0, 1],
                      outputRange: [PICKER_SLIDE_DISTANCE, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.pickerTitle}>시간 설정</Text>
            <Text style={styles.pickerValue}>{timeLabel}</Text>

            <View style={styles.wheelRow}>
              {/* 가운데 선택 밴드 */}
              <View style={styles.wheelBand} pointerEvents="none" />
              <WheelColumn
                data={HOURS.map(String)}
                selectedIndex={hourIndex}
                onSelect={setHourIndex}
                width={44}
              />
              <WheelColumn
                data={MINUTES.map(pad)}
                selectedIndex={minuteIndex}
                onSelect={setMinuteIndex}
                width={44}
              />
              <WheelColumn
                data={MERIDIEMS}
                selectedIndex={meridiemIndex}
                onSelect={setMeridiemIndex}
                width={44}
              />
            </View>
          </Animated.View>
        )}
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  // 캘린더 요일 줄 아래까지 올라오는 큰 시트.
  // overflow hidden이라 피커 카드가 시트 아래에서 밀려 올라오는 것처럼 보인다.
  sheet: {
    ...centeredSheetStyle,
    height: `${SHEET_HEIGHT_RATIO * 100}%`,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#CFCFCF",
    paddingHorizontal: 34,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetContent: {
    flex: 1,
  },
  cancelText: {
    color: "#707070",
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "Pretendard-Medium",
  },
  addText: {
    color: "#FA0C56",
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "Pretendard-Medium",
  },
  dateTitle: {
    color: "#111111",
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "Pretendard-SemiBold",
  },
  dateField: {
    height: 41,
    marginTop: 20,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: "#FFF0F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateChip: {
    minWidth: 80,
    height: 29,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: "#FFFCFD",
    alignItems: "center",
    justifyContent: "center",
  },
  // 장소 추천 목록이 아래 옵션 카드 위로 떠야 해서, 감싸는 쪽이 층을 올린다.
  // (안드로이드는 zIndex만으로는 형제보다 위로 안 올라와서 elevation도 같이 준다.)
  fieldGroupWrap: {
    marginTop: 14,
    zIndex: 30,
    elevation: 30,
  },
  // 제목/장소는 위아래로 붙은 한 덩어리 (사이에만 구분선)
  fieldGroup: {
    borderRadius: 8,
    overflow: "hidden",
  },
  // 장소 입력 바로 아래에 겹쳐 뜨는 최근 장소 목록.
  placeSuggestions: {
    position: "absolute",
    top: FIELD_GROUP_HEIGHT + 6,
    left: 0,
    right: 0,
    backgroundColor: "#FFFCFD",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CFCFCF",
    overflow: "hidden",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.10)",
  },
  placeSuggestionsHint: {
    paddingTop: 9,
    paddingBottom: 5,
    paddingHorizontal: 15,
    color: "#A0A0A0",
    fontSize: 11,
    fontFamily: "Pretendard-Medium",
  },
  placeSuggestionRow: {
    height: 38,
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  placeSuggestionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F5E9EE",
  },
  placeSuggestionText: {
    color: "#111111",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  field: {
    height: 41,
    paddingHorizontal: 15,
    backgroundColor: "#FFF0F6",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    color: "#111111",
  },
  fieldTop: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  fieldBottom: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  fieldSeparator: {
    height: 1,
    backgroundColor: "#CFCFCF",
  },
  optionCard: {
    marginTop: 20,
    backgroundColor: "#FFF0F6",
    borderRadius: 8,
  },
  optionRow: {
    height: 41,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
  },
  optionLabel: {
    color: "#A0A0A0",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  optionDivider: {
    height: 0.5,
    backgroundColor: "#A0A0A0",
  },
  timeChip: {
    width: 80,
    height: 29,
    borderRadius: 4,
    backgroundColor: "#FFFCFD",
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipText: {
    color: "#A0A0A0",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
  },
  // 디자인 기준 카드 325x340: 제목 y=28, 시간 y=87, 휠 y=136 (높이 195.67)
  pickerDismissArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // "시간" 행 바로 아래(top은 실제 위치로 계산)부터 시트 바닥까지 채운다.
  // 예전에는 top(시간 줄 아래)과 bottom을 동시에 잡아 높이가 강제됐다.
  // 남은 공간보다 내용이 크면 그대로 잘려서, 아래에만 붙이고 높이는 내용에
  // 맡긴다.
  pickerCard: {
    position: "absolute",
    left: -34,
    right: -34,
    bottom: 0,
    paddingTop: 20,
    // 휠이 카드 바닥에 딱 붙어 잘려 보여서 아래쪽 여백을 준다.
    paddingBottom: 24,
    alignItems: "center",
    backgroundColor: "#FFFCFD",
    elevation: 3,
  },
  datePickerCard: {
    position: "absolute",
    left: -34,
    right: -34,
    bottom: 0,
    height: 344,
    paddingHorizontal: 35,
    paddingTop: 25,
    backgroundColor: "#FFFCFD",
    borderTopLeftRadius: 13,
    borderTopRightRadius: 19,
    boxShadow: "0 0 2px rgba(0, 0, 0, 0.20)",
  },
  calendarPickerHeader: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calendarPickerTitle: {
    color: "#111111",
    fontSize: 15.4,
    lineHeight: 22,
    fontFamily: "Pretendard-SemiBold",
  },
  calendarPickerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  calendarPickerArrow: {
    color: "#A0A0A0",
    fontSize: 28,
    lineHeight: 28,
    fontFamily: "Pretendard-Medium",
  },
  calendarPickerGrid: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarPickerDay: {
    width: "14.2857%",
    height: 46.16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  calendarPickerDaySelected: {
    backgroundColor: "#FFF0F6",
  },
  calendarPickerDayText: {
    color: "#111111",
    fontSize: 18.1,
    lineHeight: 22,
    fontFamily: "Pretendard-Regular",
  },
  // 오늘 날짜는 선택 여부와 상관없이 키컬러로 구분한다.
  calendarPickerDayTextToday: {
    color: "#FA0C56",
    fontFamily: "Pretendard-SemiBold",
  },
  calendarPickerDayTextSelected: {
    color: "#FF0A68",
    fontSize: 21.7,
    lineHeight: 26,
  },
  pickerTitle: {
    height: 26,
    color: "#111111",
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "Pretendard-Regular",
  },
  pickerValue: {
    marginTop: 18,
    color: "#111111",
    fontSize: 24,
    lineHeight: 31.2,
    letterSpacing: 0.48,
    fontFamily: "Pretendard-Medium",
  },
  wheelRow: {
    marginTop: 14,
    width: 168.3,
    height: WHEEL_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  wheelBand: {
    position: "absolute",
    left: 5,
    right: 5,
    top: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
    height: ITEM_HEIGHT,
    borderRadius: 5.6,
    backgroundColor: "#FA0C56",
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    color: "#111111",
    fontSize: 18,
    fontFamily: "Pretendard-Regular",
  },
  wheelTextSelected: {
    color: "#FFFCFD",
    fontFamily: "Pretendard-SemiBold",
  },
});
