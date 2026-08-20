import { FoodImage } from "@/components/food-image";
import {
  AiQuestionIcon,
  ChevronRightIcon,
  XXLogoIcon,
} from "@/components/icons";
import {
  createQuestion,
  getHome,
  getVisits,
  type CalendarVisit,
  type Home,
} from "@/lib/api";
import { centeredContentStyle } from "@/lib/layout";
import {
  CARD_GAP,
  SCREEN_PADDING,
  cardShadow,
  colors,
  font,
  radius,
  type as t,
  tracking,
} from "@/lib/theme";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Figma(node 671:3009 "image 54 1")는 단일 이미지 애셋(은은한 핑크 글로우)이라
// 별도 삽화 없이 그라디언트로 재현한다. 실제 PNG 애셋을 쓰고 싶다면 Figma에서
// 내보내 assets에 넣고 이 컴포넌트를 <Image>로 교체하면 됨.
function UploadGlow() {
  return (
    <LinearGradient
      colors={["#FFD9E8", "#FFFCFD", "#FFD9E8"]}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.uploadGlow}
      pointerEvents="none"
    />
  );
}

/** 홈 주간 캘린더의 "2026-08-19" → 일정 목록이 쓰는 "26.08.19" */
function toVisitDate(isoDate: string): string {
  return `${isoDate.slice(2, 4)}.${isoDate.slice(5, 7)}.${isoDate.slice(8, 10)}`;
}

// 홈은 GET /api/v1/home 한 번으로 인사말·최신 검사지 요약·추천 질문·추천 재료·
// 주간 캘린더를 전부 받는다. 검사지를 아직 안 올렸으면 latestSheet가 null이고
// questions·nutritions가 빈 배열로 오는데, 그때는 각 카드가 안내 문구로 바뀐다.
export default function Home() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  // 질문 전송 상태. 저장은 lib/api의 createQuestion(POST /questions)이 맡는다.
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [visits, setVisits] = useState<CalendarVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getHome(), getVisits()]).then(([result, visitList]) => {
        if (!active) return;
        setHome(result);
        setVisits(visitList);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const latestSheet = home?.latestSheet ?? null;
  const questions = home?.questions ?? [];
  const [sendingQuestion, setSendingQuestion] = useState(false);

  /**
   * 직접 적은 질문을 서버에 올린다.
   *
   * 최신 검사지가 있으면 그 검사지에 달아서, 캘린더에서 그 검사지 다음 진료를
   * 펼쳤을 때 추천 질문과 함께 보이게 한다. 검사지가 아직 없으면 검사지 없이
   * 저장한다. 올린 뒤에는 홈을 다시 읽어 목록에 바로 반영한다.
   */
  async function submitQuestion() {
    const text = question.trim();
    if (!text || sendingQuestion) return;
    setSendingQuestion(true);
    try {
      await createQuestion(text, latestSheet?.testSheetId ?? null);
      setQuestion("");
      setHome(await getHome());
      setSentNotice("다음 진료 질문에 추가했어요.");
    } catch (error) {
      // 실패를 조용히 넘기면 사용자는 저장된 줄 안다. 화면에도 반드시 알린다.
      console.warn("[home] 질문 저장 실패:", error);
      setSentNotice("질문을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSendingQuestion(false);
      setTimeout(() => setSentNotice(null), 2600);
    }
  }
  const nutritions = home?.nutritions ?? [];

  // 서버 주간 캘린더에 방금 추가한 일정이 아직 안 반영돼 있어도 홈에서 바로
  // 보이도록, 캘린더 탭과 같은 일정 목록(GET /app/visits)을 겹쳐서 표시한다.
  const days = useMemo(() => {
    const weekly = home?.weeklyCalendar ?? [];
    if (weekly.length === 0 || visits.length === 0) return weekly;
    return weekly.map((day) => {
      const dayVisits = visits.filter(
        (visit) => visit.date === toVisitDate(day.date),
      );
      if (dayVisits.length === 0) return day;
      // 홈에서는 장소·제목을 적지 않고 점만 찍는다(캘린더 탭에서 확인).
      return { ...day, hasAppointment: true };
    });
  }, [home?.weeklyCalendar, visits]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.bgFrom, colors.bgTo]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          style={centeredContentStyle}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <XXLogoIcon />
          {/*
            Figma(837:4268): 24/32, 자간 -0.64, 2줄 68px.
            서버 인사말(home.greeting)은 줄바꿈 없이 한 문장으로 오는 경우가 있어
            줄 수를 고정하지 않는다. minHeight로 두 줄 자리를 미리 잡아두면
            인사말이 도착하기 전후로 아래 카드가 덜컥 움직이지 않는다.
          */}
          <Text style={styles.heading}>
            {home?.greeting || "지금 내 몸은 어떻게\n변하고 있을까요?"}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.uploadCard,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/(modals)/scan")}
          >
            <UploadGlow />
            <View style={styles.uploadCopy}>
              <Text style={styles.eyebrow}>언제든 간편하게</Text>
              <Text style={styles.uploadTitle}>내 검사지 업로드</Text>
            </View>
            <View style={styles.uploadButton}>
              <Text style={styles.uploadButtonText}>올리기</Text>
            </View>
          </Pressable>

          <View style={styles.questionCard}>
            {loading ? (
              <Text style={styles.cardHint}>질문을 불러오는 중이에요...</Text>
            ) : questions.length > 0 ? (
              // 추천 질문을 눌러 입력창에 담고, 다듬어서 바로 추가할 수 있게 한다.
              questions.slice(0, 2).map((item) => (
                <Pressable
                  key={item.questionId}
                  style={({ pressed }) => [
                    styles.exampleRow,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setQuestion(item.content)}
                  accessibilityRole="button"
                  accessibilityLabel={`추천 질문 담기: ${item.content}`}
                >
                  <AiQuestionIcon />
                  <Text style={styles.example} numberOfLines={1}>
                    {item.content}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.cardHint}>
                검사지를 올리면 진료 때 여쭤볼 질문을 추천해드려요.
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
                      styles.send,
                      sendingQuestion && styles.sendDisabled,
                    ]}
                  >
                    ↑
                  </Text>
                </Pressable>
              )}
            </View>
            {!!sentNotice && (
              <Text style={styles.sentNotice}>{sentNotice}</Text>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.analysisCard,
              pressed && styles.pressed,
            ]}
            onPress={() =>
              latestSheet
                ? router.push({
                    pathname: "/(tabs)/analysis/report",
                    params: { recordId: String(latestSheet.testSheetId) },
                  })
                : router.push("/(tabs)/analysis")
            }
          >
            <View style={styles.analysisLink}>
              <Text style={styles.sectionTitle}>분석</Text>
              <ChevronRightIcon size={20} />
            </View>
            <Text style={styles.analysisText} numberOfLines={2}>
              {latestSheet?.summaryPreview ||
                "검사지를 올리면 쉬운 번역본 요약을 여기서 볼 수 있어요."}
            </Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>추천 재료</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.ingredients}
            >
              {nutritions.map((food) => (
                <View
                  key={`${food.name}-${food.nutrient}`}
                  style={styles.ingredient}
                >
                  <FoodImage name={food.name} />
                  <Text style={styles.ingredientName} numberOfLines={1}>
                    {food.name}
                  </Text>
                </View>
              ))}
              {!loading && nutritions.length === 0 && (
                <Text style={styles.cardHint}>
                  {latestSheet
                    ? "이번 검사에서는 특별히 보충할 항목이 없어요."
                    : "검사지를 올리면 맞춤 재료를 추천해드려요."}
                </Text>
              )}
            </ScrollView>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.calendarCard,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/(tabs)/calendar")}
          >
            <Text style={styles.sectionTitle}>캘린더</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.days}
            >
              {days.map((item) => (
                <View
                  key={item.date}
                  style={[
                    styles.dayCard,
                    item.isToday && styles.dayCardSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      item.isToday && styles.daySelectedText,
                    ]}
                  >
                    {item.day}
                  </Text>
                  <Text
                    style={[
                      styles.dayLabel,
                      item.isToday && styles.daySelectedText,
                    ]}
                  >
                    {item.dayOfWeek}
                  </Text>
                  {item.hasAppointment && (
                    <View
                      style={[
                        styles.eventDot,
                        !item.isToday && styles.eventDotOnLight,
                      ]}
                    />
                  )}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const shadow = cardShadow;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 67,
    paddingBottom: 22,
    gap: CARD_GAP,
  },
  // Figma: XX 로고(top 112~136)와 헤딩(top 140) 사이 간격은 4px, 헤딩과 업로드 카드(top 224)
  // 사이 간격은 16px. 컨테이너 기본 gap이 12라 헤딩에서 위/아래로 보정한다.
  // minHeight 64 = 32(행간) × 2줄. 인사말이 한 줄이어도 자리를 잡아둔다.
  heading: { marginTop: -8, marginBottom: 4, minHeight: 64, ...t.heading24 },

  // ---- 업로드 카드 (Figma 837:4269, h152 r20) ----
  uploadCard: {
    height: 152,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    ...shadow,
  },
  pressed: { opacity: 0.78 },
  // Figma의 "image 54 1"은 카드보다 조금 큰 글로우 PNG다. 폭이 화면따라 늘어나야 해서
  // 고정 크기 대신 절대 위치로 카드를 가득 채운다.
  uploadGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.8,
  },
  // eyebrow 중심 103.5 / title 중심 127.5 (24px 간격) → 블록 높이 48, 아래 여백 12.
  uploadCopy: { position: "absolute", left: 20, bottom: 12 },
  eyebrow: { ...t.body14, lineHeight: 22 },
  uploadTitle: { ...t.title18 },
  // Figma 837:4273: left 277 / top 108 / 63×28 → 오른쪽 21, 아래 16.
  uploadButton: {
    position: "absolute",
    right: 21,
    bottom: 16,
    width: 63,
    height: 28,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.xs,
    backgroundColor: colors.white,
  },
  uploadButtonText: {
    fontFamily: font.semiBold,
    fontSize: 12,
    letterSpacing: tracking(12),
    color: "#000000",
  },

  // ---- 질문 카드 (Figma 837:4275, h113 r14) ----
  // 디자인에는 추천 질문 2줄과 입력창만 있지만, 실제로는 추천 질문을 눌러 담고
  // 직접 쓴 질문을 서버에 올리는 기능이 붙어 있다(전송 버튼·안내 문구).
  // 그래서 높이를 고정하지 않고 minHeight로 둔다.
  questionCard: {
    minHeight: 113,
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 13,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  exampleRow: {
    height: 21,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  example: { ...t.body14, flex: 1 },
  cardHint: {
    paddingVertical: 6,
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: tracking(13),
    color: colors.textHint,
  },
  // 입력창 top 61 − (paddingTop 13 + 행 21×2) = 6
  inputWrap: {
    height: 41,
    marginTop: 6,
    borderRadius: radius.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfacePink,
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 15,
    ...t.body14,
    color: colors.text,
  },
  send: {
    marginRight: 14,
    fontFamily: font.semiBold,
    fontSize: 18,
    color: colors.brandStrong,
  },
  sendDisabled: { opacity: 0.4 },
  sentNotice: {
    marginTop: 6,
    fontFamily: font.medium,
    fontSize: 12,
    letterSpacing: tracking(12),
    color: colors.textSub,
  },

  // ---- 분석 카드 (Figma 837:4284, h62 r14) ----
  analysisCard: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow,
  },
  // 라벨 left 18 → 요약문 left 79 = 61
  analysisLink: { width: 61, flexDirection: "row", alignItems: "center" },
  analysisText: { ...t.read14, flex: 1, marginLeft: 1 },

  // ---- 추천 재료 (Figma 837:4288, h126 r14) ----
  card: {
    height: 126,
    paddingTop: 11,
    paddingLeft: 17,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
    ...shadow,
  },
  sectionTitle: { ...t.section16 },
  // 타일 top 39 − (paddingTop 11 + 제목 행간 24) = 4
  ingredients: { paddingTop: 4, paddingRight: 17, gap: 8 },
  ingredient: {
    width: 67,
    height: 76,
    borderRadius: radius.tile,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    backgroundColor: colors.surfacePink,
  },
  ingredientName: { ...t.caption12, lineHeight: 14 },
  moreDots: {
    width: 24,
    height: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textHint,
  },
  dotMuted: { opacity: 0.6 },
  dotFaint: { opacity: 0.4 },

  // ---- 캘린더 (Figma 837:4321, h126 r14) ----
  calendarCard: {
    height: 126,
    paddingTop: 11,
    paddingLeft: 17,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
    ...shadow,
  },
  // 날짜 칸 top 45 − (paddingTop 11 + 제목 행간 24) = 10
  days: { paddingTop: 10, paddingRight: 17, gap: 11 },
  dayCard: {
    width: 54,
    height: 66,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    borderRadius: radius.sm,
    alignItems: "center",
    paddingTop: 7,
    backgroundColor: colors.surface,
  },
  // 오늘 칸은 테두리 없이 꽉 찬 핑크(Figma 837:4327). borderColor를 같이 맞춰야
  // 1px 테두리가 남아 다른 칸보다 안쪽이 좁아 보이는 일이 없다.
  dayCardSelected: {
    borderColor: colors.brandStrong,
    backgroundColor: colors.brandStrong,
  },
  dayNumber: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSub,
  },
  dayLabel: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSub,
  },
  daySelectedText: { color: colors.surface },
  // 오늘 칸은 배경이 핑크라 흰 점이 보이지만, 나머지 칸은 배경이 흰색이라
  // 같은 흰 점을 쓰면 일정이 있어도 아무것도 안 보인다.
  eventDot: {
    position: "absolute",
    bottom: 9,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surface,
  },
  eventDotOnLight: { backgroundColor: colors.brandStrong },
  appointment: {
    position: "absolute",
    bottom: 5,
    fontFamily: font.regular,
    fontSize: 8,
    color: colors.text,
  },
});
