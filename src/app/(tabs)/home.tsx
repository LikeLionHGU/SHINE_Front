import {
  ChevronRightIcon,
  AiQuestionIcon,
  XXLogoIcon,
} from "@/components/icons";
import { FoodImage } from "@/components/food-image";
import {
  getHome,
  getVisits,
  getVisitQuestions,
  saveVisitQuestions,
  formatVisitDate,
  type CalendarVisit,
  type Home,
} from "@/lib/api";
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
import { centeredContentStyle, visitDateLabel } from "@/lib/layout";

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
  // 질문 전송 상태. 저장은 다음 산부인과 일정(없으면 오늘)에 붙는다.
  const [sending, setSending] = useState(false);
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

  /** 질문을 붙일 날짜 — 오늘 이후의 가장 가까운 산부인과 일정, 없으면 오늘 */
  function targetVisitDate(): string {
    // 이 앱의 날짜 포맷은 ISO가 아니라 "26.08.16"(YY.MM.DD)이다.
    const today = formatVisitDate(new Date());
    const upcoming = visits
      .filter((v) => v.isHospital && v.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return upcoming?.date ?? today;
  }

  /** 직접 적은 질문을 진료 질문 목록에 추가한다. */
  async function submitQuestion() {
    const text = question.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const date = targetVisitDate();
      const existing = await getVisitQuestions(date).catch(() => [] as string[]);
      if (existing.some((q) => q.trim() === text)) {
        setSentNotice("이미 추가된 질문이에요.");
      } else {
        await saveVisitQuestions(date, [...existing, text]);
        setSentNotice(`${visitDateLabel(date)} 진료 질문에 추가했어요.`);
      }
      setQuestion("");
    } catch {
      setSentNotice("질문을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
      setTimeout(() => setSentNotice(null), 2600);
    }
  }

  const latestSheet = home?.latestSheet ?? null;
  const questions = home?.questions ?? [];
  const nutritions = home?.nutritions ?? [];

  // 서버 주간 캘린더에 방금 추가한 일정이 아직 안 반영돼 있어도 홈에서 바로
  // 보이도록, 캘린더 탭과 같은 일정 목록(GET /app/visits)을 겹쳐서 표시한다.
  const days = useMemo(() => {
    const weekly = home?.weeklyCalendar ?? [];
    if (weekly.length === 0 || visits.length === 0) return weekly;
    return weekly.map((day) => {
      const dayVisits = visits.filter((visit) => visit.date === toVisitDate(day.date));
      if (dayVisits.length === 0) return day;
      // 홈에서는 장소·제목을 적지 않고 점만 찍는다(캘린더 탭에서 확인).
      return { ...day, hasAppointment: true };
    });
  }, [home?.weeklyCalendar, visits]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          style={centeredContentStyle}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <XXLogoIcon width={65} />
          <Text style={styles.heading}>{home?.greeting || "지금 내 몸은 어떻게\n변하고 있을까요?"}</Text>

          <Pressable style={({ pressed }) => [styles.uploadCard, pressed && styles.pressed]} onPress={() => router.push("/(modals)/scan")}>
            <UploadGlow />
            <View style={styles.uploadCopy}>
              <Text style={styles.eyebrow}>언제든 간편하게</Text>
              <Text style={styles.uploadTitle}>내 검사지 업로드</Text>
            </View>
            <View style={styles.uploadButton}><Text style={styles.uploadButtonText}>올리기</Text></View>
          </Pressable>

          <View style={styles.questionCard}>
            {loading ? (
              <Text style={styles.cardHint}>질문을 불러오는 중이에요...</Text>
            ) : questions.length > 0 ? (
              // 추천 질문을 눌러 입력창에 담고, 다듬어서 바로 추가할 수 있게 한다.
              questions.slice(0, 2).map((item) => (
                <Pressable
                  key={item.questionId}
                  style={({ pressed }) => [styles.exampleRow, pressed && styles.pressed]}
                  onPress={() => setQuestion(item.content)}
                  accessibilityRole="button"
                  accessibilityLabel={`추천 질문 담기: ${item.content}`}
                >
                  <AiQuestionIcon />
                  <Text style={styles.example} numberOfLines={1}>{item.content}</Text>
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
                editable={!sending}
              />
              {question.trim().length > 0 && (
                <Pressable
                  onPress={submitQuestion}
                  disabled={sending}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="질문 추가"
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={[styles.send, sending && styles.sendDisabled]}>↑</Text>
                </Pressable>
              )}
            </View>
            {!!sentNotice && <Text style={styles.sentNotice}>{sentNotice}</Text>}
          </View>

          <Pressable style={({ pressed }) => [styles.analysisCard, pressed && styles.pressed]} onPress={() =>
              latestSheet
                ? router.push({
                    pathname: "/(tabs)/analysis/report",
                    params: { recordId: String(latestSheet.testSheetId) },
                  })
                : router.push("/(tabs)/analysis")
            }
          >
            <View style={styles.analysisLink}><Text style={styles.sectionTitle}>분석</Text><ChevronRightIcon size={20} /></View>
            <Text style={styles.analysisText} numberOfLines={2}>
              {latestSheet?.summaryPreview || "검사지를 올리면 쉬운 번역본 요약을 여기서 볼 수 있어요."}
            </Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>추천 재료</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ingredients}>
              {nutritions.map((food) => (
                <View key={`${food.name}-${food.nutrient}`} style={styles.ingredient}>
                  <FoodImage name={food.name} />
                  <Text style={styles.ingredientName} numberOfLines={1}>{food.name}</Text>
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

          <Pressable style={({ pressed }) => [styles.calendarCard, pressed && styles.pressed]} onPress={() => router.push("/(tabs)/calendar")}>
            <Text style={styles.sectionTitle}>캘린더</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
              {days.map((item) => (
                <View key={item.date} style={[styles.dayCard, item.isToday && styles.dayCardSelected]}>
                  <Text style={[styles.dayNumber, item.isToday && styles.daySelectedText]}>{item.day}</Text>
                  <Text style={[styles.dayLabel, item.isToday && styles.daySelectedText]}>{item.dayOfWeek}</Text>
                  {item.hasAppointment && <View style={styles.eventDot} />}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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
  content: { paddingHorizontal: 16, paddingTop: 42, paddingBottom: 22, gap: 12 },
  // Figma: XX 로고(top 112~136)와 헤딩(top 140) 사이 간격은 4px, 헤딩과 업로드 카드(top 224)
  // 사이 간격은 16px. 컨테이너 기본 gap이 12라 헤딩에서 위/아래로 보정한다.
  heading: { marginTop: -8, marginBottom: 4, color: "#4C4C4C", fontFamily: "Pretendard-SemiBold", fontSize: 24, lineHeight: 32 },
  uploadCard: { height: 152, borderRadius: 20, overflow: "hidden", backgroundColor: "#FFFCFD", ...shadow },
  pressed: { opacity: 0.78 },
  // 카드 폭(고정 px가 아니라 flex로 화면 폭에 맞춰 늘어남)을 그대로 덮도록
  // 절대 위치 + 상하좌우 0으로 채운다 — 예전엔 고정 362x182였어서 카드 폭이
  // Figma 기준(361px)과 다른 화면에서는 글로우가 카드보다 짧거나 길게 튀어나왔다.
  uploadGlow: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.8 },
  uploadCopy: { position: "absolute", left: 20, bottom: 13 },
  eyebrow: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 14, lineHeight: 22 },
  uploadTitle: { color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 18, lineHeight: 26 },
  uploadButton: { position: "absolute", right: 20, bottom: 16, height: 28, paddingHorizontal: 16, borderRadius: 6, justifyContent: "center", backgroundColor: "#FFF" },
  uploadButtonText: { color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 12 },
  sendDisabled: { opacity: 0.4 },
  sentNotice: { marginTop: 2, paddingHorizontal: 18, color: "#3A6B5C", fontFamily: "Pretendard-Medium", fontSize: 12 },
  questionCard: { minHeight: 113, paddingHorizontal: 18, paddingTop: 11, borderRadius: 14, backgroundColor: "#FFFCFD", ...shadow },
  exampleRow: { height: 21, flexDirection: "row", alignItems: "center", gap: 9 },
  example: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 14, flex: 1 },
  cardHint: { paddingVertical: 6, color: "#A0A0A0", fontFamily: "Pretendard-Regular", fontSize: 13, lineHeight: 20 },
  inputWrap: { height: 41, marginTop: 7, borderRadius: 8, flexDirection: "row", alignItems: "center", backgroundColor: "#FFF0F6" },
  input: { flex: 1, height: "100%", paddingHorizontal: 15, color: "#111", fontFamily: "Pretendard-Medium", fontSize: 14 },
  send: { marginRight: 14, color: "#FA0C56", fontFamily: "Pretendard-SemiBold", fontSize: 18 },
  analysisCard: { minHeight: 62, paddingHorizontal: 18, paddingVertical: 13, flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: "#FFFCFD", ...shadow },
  analysisLink: { width: 61, flexDirection: "row", alignItems: "center" },
  analysisText: { flex: 1, marginLeft: 1, color: "#111", fontFamily: "Pretendard-Regular", fontSize: 14, lineHeight: 18 },
  card: { height: 126, paddingTop: 11, paddingLeft: 17, borderRadius: 14, overflow: "hidden", backgroundColor: "#FFFCFD", ...shadow },
  sectionTitle: { color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16, lineHeight: 24 },
  ingredients: { paddingTop: 4, paddingRight: 17, gap: 8 },
  ingredient: { width: 67, height: 76, borderRadius: 4, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, backgroundColor: "#FFF0F6" },
  ingredientName: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 12 },
  moreDots: { width: 24, height: 76, flexDirection: "row", alignItems: "center", gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#A0A0A0" },
  dotMuted: { opacity: 0.6 },
  dotFaint: { opacity: 0.4 },
  calendarCard: { height: 126, paddingTop: 11, paddingLeft: 17, borderRadius: 14, overflow: "hidden", backgroundColor: "#FFFCFD", ...shadow },
  days: { paddingTop: 7, paddingRight: 17, gap: 11 },
  dayCard: { width: 54, height: 66, borderWidth: 1, borderColor: "#FFCEE1", borderRadius: 8, alignItems: "center", paddingTop: 7, backgroundColor: "#FFFCFD" },
  dayCardSelected: { borderColor: "#FA0C56", backgroundColor: "#FA0C56" },
  dayNumber: { color: "#707070", fontFamily: "Pretendard-Regular", fontSize: 12, lineHeight: 18 },
  dayLabel: { color: "#707070", fontFamily: "Pretendard-Regular", fontSize: 12, lineHeight: 17 },
  daySelectedText: { color: "#FFFCFD" },
  eventDot: { position: "absolute", bottom: 9, width: 5, height: 5, borderRadius: 3, backgroundColor: "#FFFCFD" },
  appointment: { position: "absolute", bottom: 5, color: "#111", fontFamily: "Pretendard-Regular", fontSize: 8 },
});
