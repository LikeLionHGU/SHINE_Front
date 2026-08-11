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

/** 휠에는 AM/PM으로 표기하고, 화면 상단 요약에는 오전/오후로 보여준다. */
const MERIDIEMS = ["AM", "PM"];
const MERIDIEM_LABELS = ["오전", "오후"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** 휠 한 칸 높이. 선택 밴드와 스냅 간격이 이 값을 공유한다. */
const ITEM_HEIGHT = 28;
const VISIBLE_ITEMS = 7;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

/** 피커 카드가 아래에서 올라올 때의 이동 거리 */
const PICKER_SLIDE_DISTANCE = 320;

/** 시트가 차지하는 화면 비율. 열릴 때 이 높이만큼 아래에서 올라온다. */
const SHEET_HEIGHT_RATIO = 0.73;

function pad(value: number) {
  return String(value).padStart(2, "0");
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
  const { date } = useLocalSearchParams<{ date?: string }>();

  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [isHospital, setIsHospital] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [meridiemIndex, setMeridiemIndex] = useState(1);
  const [hourIndex, setHourIndex] = useState(2);
  const [minuteIndex, setMinuteIndex] = useState(0);

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
    if (pickerOpen) {
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
  }, [pickerOpen, slide]);

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
        <SafeAreaView edges={["bottom"]}>
          <View style={styles.header}>
            <Pressable onPress={closeSheet} hitSlop={8}>
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
            <Text style={styles.dateTitle}>{date ?? "08.26"}</Text>
            <Pressable onPress={closeSheet} hitSlop={8}>
              <Text style={styles.addText}>추가</Text>
            </Pressable>
          </View>

        <View style={styles.fieldGroup}>
          <TextInput
            style={[styles.field, styles.fieldTop]}
            placeholder="제목"
            placeholderTextColor="#A0A0A0"
            value={title}
            onChangeText={setTitle}
          />
          <View style={styles.fieldSeparator} />
          <TextInput
            style={[styles.field, styles.fieldBottom]}
            placeholder="장소 또는 위치"
            placeholderTextColor="#A0A0A0"
            value={place}
            onChangeText={setPlace}
          />
        </View>

        <View style={styles.optionCard}>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>시간</Text>
            <Pressable
              style={styles.timeChip}
              onPress={() => setPickerOpen((open) => !open)}
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

        {pickerMounted && (
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
    fontSize: 24,
    lineHeight: 32,
    fontFamily: "Pretendard-SemiBold",
  },
  // 제목/장소는 위아래로 붙은 한 덩어리 (사이에만 구분선)
  fieldGroup: {
    marginTop: 20,
    borderRadius: 8,
    overflow: "hidden",
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
  pickerCard: {
    marginTop: 16,
    paddingTop: 28,
    paddingBottom: 8,
    alignItems: "center",
    backgroundColor: "#FFFCFD",
    borderRadius: 12,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  pickerTitle: {
    height: 26,
    color: "#111111",
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "Pretendard-Regular",
  },
  pickerValue: {
    marginTop: 33,
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
