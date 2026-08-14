import {
  ChevronRightIcon,
  SparkleIcon,
  XXLogoIcon,
} from "@/components/icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const INGREDIENTS = ["달걀", "연어", "시금치", "버섯"];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

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

export default function Home() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const days = useMemo(
    () => [15, 16, 17, 18, 19, 20, 21].map((date, index) => ({ date, day: WEEKDAYS[index] })),
    [],
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <XXLogoIcon width={65} />
          <Text style={styles.heading}>지금 내 몸은 어떻게{"\n"}변하고 있을까요?</Text>

          <Pressable style={({ pressed }) => [styles.uploadCard, pressed && styles.pressed]} onPress={() => router.push("/(modals)/scan")}>
            <UploadGlow />
            <View style={styles.uploadCopy}>
              <Text style={styles.eyebrow}>언제든 간편하게</Text>
              <Text style={styles.uploadTitle}>내 검사지 업로드</Text>
            </View>
            <View style={styles.uploadButton}><Text style={styles.uploadButtonText}>올리기</Text></View>
          </Pressable>

          <View style={styles.questionCard}>
            <View style={styles.exampleRow}><SparkleIcon /><Text style={styles.example}>Ex) 당 수치가 올라가고 있는데 괜찮나요?</Text></View>
            <View style={styles.exampleRow}><SparkleIcon /><Text style={styles.example}>Ex) 비타민 D 수치가 떨어지고 있는데 괜찮나요?</Text></View>
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

          <Pressable style={({ pressed }) => [styles.analysisCard, pressed && styles.pressed]} onPress={() => router.push("/(tabs)/analysis")}>
            <View style={styles.analysisLink}><Text style={styles.sectionTitle}>분석</Text><ChevronRightIcon size={20} /></View>
            <Text style={styles.analysisText}>쉬운 번역본 두줄이 요약되어 적힙니다.{"\n"}관련 결과 전체적으로 안정적인 수치를 띄...</Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>추천 재료</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ingredients}>
              {INGREDIENTS.map((name) => (
                <View key={name} style={styles.ingredient}>
                  <Text style={styles.ingredientName}>{name}</Text>
                </View>
              ))}
              <View style={styles.moreDots}><View style={styles.dot} /><View style={[styles.dot, styles.dotMuted]} /><View style={[styles.dot, styles.dotFaint]} /></View>
            </ScrollView>
          </View>

          <Pressable style={({ pressed }) => [styles.calendarCard, pressed && styles.pressed]} onPress={() => router.push("/(tabs)/calendar")}>
            <Text style={styles.sectionTitle}>캘린더</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
              {days.map(({ date, day }) => {
                const selected = date === 16;
                return (
                  <View key={date} style={[styles.dayCard, selected && styles.dayCardSelected]}>
                    <Text style={[styles.dayNumber, selected && styles.daySelectedText]}>{date}</Text>
                    <Text style={[styles.dayLabel, selected && styles.daySelectedText]}>{day}</Text>
                    {selected && <View style={styles.eventDot} />}
                    {date === 18 && <Text style={styles.appointment}>이비인후..</Text>}
                  </View>
                );
              })}
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
  uploadGlow: { position: "absolute", left: -1, top: -10, width: 362, height: 182, opacity: 0.8 },
  uploadCopy: { position: "absolute", left: 20, bottom: 13 },
  eyebrow: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 14, lineHeight: 22 },
  uploadTitle: { color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 18, lineHeight: 26 },
  uploadButton: { position: "absolute", right: 20, bottom: 16, height: 28, paddingHorizontal: 16, borderRadius: 6, justifyContent: "center", backgroundColor: "#FFF" },
  uploadButtonText: { color: "#111", fontFamily: "Pretendard-SemiBold", fontSize: 12 },
  questionCard: { height: 113, paddingHorizontal: 18, paddingTop: 11, borderRadius: 14, backgroundColor: "#FFFCFD", ...shadow },
  exampleRow: { height: 21, flexDirection: "row", alignItems: "center", gap: 9 },
  example: { color: "#707070", fontFamily: "Pretendard-Medium", fontSize: 14 },
  inputWrap: { height: 41, marginTop: 7, borderRadius: 8, flexDirection: "row", alignItems: "center", backgroundColor: "#FFF0F6" },
  input: { flex: 1, height: "100%", paddingHorizontal: 15, color: "#111", fontFamily: "Pretendard-Medium", fontSize: 14 },
  send: { marginRight: 14, color: "#FA0C56", fontFamily: "Pretendard-SemiBold", fontSize: 18 },
  analysisCard: { minHeight: 62, paddingHorizontal: 18, paddingVertical: 13, flexDirection: "row", alignItems: "center", borderRadius: 14, backgroundColor: "#FFFCFD", ...shadow },
  analysisLink: { width: 61, flexDirection: "row", alignItems: "center" },
  analysisText: { flex: 1, marginLeft: 1, color: "#111", fontFamily: "Pretendard-Regular", fontSize: 14, lineHeight: 18 },
  card: { height: 126, paddingTop: 11, paddingLeft: 17, borderRadius: 14, overflow: "hidden", backgroundColor: "#FFFCFD", ...shadow },
  sectionTitle: { color: "#111", fontFamily: "Pretendard-Medium", fontSize: 16, lineHeight: 24 },
  ingredients: { paddingTop: 4, paddingRight: 17, gap: 8 },
  ingredient: { width: 67, height: 76, borderRadius: 4, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8, backgroundColor: "#FFF0F6" },
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
