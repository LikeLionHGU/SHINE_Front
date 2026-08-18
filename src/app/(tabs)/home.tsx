import {
  ChevronRightIcon,
  SparkleIcon,
  XXLogoIcon,
} from "@/components/icons";
import { FoodImage } from "@/components/food-image";
import { getHome, type Home } from "@/lib/api";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { centeredContentStyle } from "@/lib/layout";

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

// 홈은 GET /api/v1/home 한 번으로 인사말·최신 검사지 요약·추천 질문·추천 재료·
// 주간 캘린더를 전부 받는다. 검사지를 아직 안 올렸으면 latestSheet가 null이고
// questions·nutritions가 빈 배열로 오는데, 그때는 각 카드가 안내 문구로 바뀐다.
export default function Home() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [home, setHome] = useState<Home | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getHome().then((result) => {
        if (!active) return;
        setHome(result);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const latestSheet = home?.latestSheet ?? null;
  const questions = home?.questions ?? [];
  const nutritions = home?.nutritions ?? [];
  const days = home?.weeklyCalendar ?? [];

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
              questions.slice(0, 2).map((item) => (
                <View key={item.questionId} style={styles.exampleRow}>
                  <SparkleIcon />
                  <Text style={styles.example} numberOfLines={1}>{item.content}</Text>
                </View>
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
              />
              {question.length > 0 && <Text style={styles.send}>↑</Text>}
            </View>
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
                  {item.label && <Text style={styles.appointment} numberOfLines={1}>{item.label}</Text>}
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
  questionCard: { height: 113, paddingHorizontal: 18, paddingTop: 11, borderRadius: 14, backgroundColor: "#FFFCFD", ...shadow },
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
