import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BackChevronIcon, ChevronRightIcon, PlusIcon } from "@/components/icons";

// 실제 검사/질문 데이터 연동 전까지의 예시
const PREVIOUS_REPORT_DATE = "2026. 07. 15";
const SUGGESTED_QUESTIONS = [
  "Ex) 당 수치가 올라가고 있는데 괜찮나요?",
  "Ex) 비타민 D 수치가 떨어지고 있는데 괜찮나요?",
];

/** "2026-08-15" → "2026. 08. 15" */
function formatDate(value: string | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}. ${month}. ${day}`;
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

  const hasAddedQuestion = questions.some((question) => question.trim().length > 0);
  const canAddMore =
    hasAddedQuestion && questions[questions.length - 1].trim().length > 0;

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

          <View style={styles.reportCard}>
            <Text style={styles.reportLabelMuted}>당일검사지</Text>
            <Text style={styles.reportNote}>*진료 후 업로드됩니다</Text>
          </View>

          <Pressable style={[styles.reportCard, styles.reportCardSpacing]}>
            <Text style={styles.reportLabel}>이전검사지</Text>
            <Text style={styles.reportDate}>{PREVIOUS_REPORT_DATE}</Text>
            <ChevronRightIcon size={20} />
          </Pressable>

          <View style={styles.questionCard}>
            <Text style={styles.questionCardTitle}>다음 진료 때 여쭤보아요</Text>

            {SUGGESTED_QUESTIONS.map((text, i) => (
              <View key={i} style={styles.questionRow}>
                <Image
                  source={require("@/assets/images/AIicon.png")}
                  style={styles.questionIcon}
                  contentFit="contain"
                />
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
        </ScrollView>
      </SafeAreaView>
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
    paddingHorizontal: 12,
    paddingTop: 10,
  },
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
  reportCard: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: "#FFFCFD",
    borderRadius: 14,
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
  questionIcon: {
    width: 16,
    height: 16,
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
