import { useState } from "react";
import { useScrollToTop } from "@/lib/use-scroll-top";
import { headerBar } from "@/lib/theme";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { BackChevronIcon, ChevronDownIcon, XXLogoIcon } from "@/components/icons";

/** 질문 하나. 누르면 아래로 답이 펼쳐진다. */
type Faq = { question: string; answer: string };

const FAQS: Faq[] = [
  {
    question: "검사지는 어떻게 올리나요?",
    answer:
      "홈 화면의 '내 검사지 업로드'에서 올리기를 누르고, 사진을 찍거나 앨범에서 검사지 사진을 고르면 돼요.\n표가 잘 보이도록 검사지 전체가 화면에 들어오게 찍어주세요.",
  },
  {
    question: "검사 결과는 어떻게 읽어주나요?",
    answer:
      "올린 사진에서 검사 항목과 수치를 읽어낸 뒤, 임신 중 기준으로 다시 판정해서 안심·주의·위험으로 나눠 보여드려요.\n검사지에 인쇄된 참고치는 임신하지 않은 사람 기준인 경우가 많아, 같은 수치라도 판정이 다를 수 있어요.",
  },
  {
    question: "결과를 못 읽은 항목은 왜 생기나요?",
    answer:
      "사진이 흐리거나 표가 잘린 경우, 또는 아직 등록되지 않은 검사 항목인 경우예요.\n이런 항목은 '확인 필요'로 표시되고 수치는 그대로 보여드려요. 다시 찍어서 올리면 인식률이 올라갑니다.",
  },
  {
    question: "추천 질문은 무엇인가요?",
    answer:
      "검사 결과에서 눈여겨볼 부분을 골라, 다음 진료 때 의사 선생님께 여쭤보면 좋을 질문으로 만들어 드려요.\n캘린더에서 진료 일정을 펼치면 그 진료 전에 받은 검사지 기준으로 질문이 보입니다.",
  },
  {
    question: "추천 재료는 어떤 기준인가요?",
    answer:
      "이번 검사에서 신경 쓰면 좋을 항목을 보완하는 데 도움이 되는 음식을 골라 드려요.\n식단 참고용이며, 보충제나 치료를 대신하지 않습니다.",
  },
  {
    question: "보호자와 결과를 공유할 수 있나요?",
    answer:
      "캘린더 화면의 '공유하기'를 누르면 회원가입 때 입력한 보호자 이메일로 일정과 분석 결과를 보낼 수 있어요.\n보호자 이메일은 마이 페이지에서 확인할 수 있습니다.",
  },
  {
    question: "분석 결과를 의료 판단에 써도 되나요?",
    answer:
      "아니요. 검사지를 읽기 쉽게 옮기고 참고 정보를 더해주는 서비스예요.\n진단과 처방은 반드시 의료진에게 확인해주세요.",
  },
];

// 마이 페이지 > 기본 설정 > FAQ.
// 설정 화면과 같은 배경·카드·구분선 스타일을 그대로 쓰고, 질문을 누르면
// 답이 아래로 펼쳐지는 아코디언 한 개만 얹었다.
export default function Faq() {
  // 화면에 들어올 때마다 스크롤을 맨 위로 되돌린다.
  const scrollRef = useScrollToTop();
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/settings");
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={8}>
            <BackChevronIcon color="#111111" />
          </Pressable>
          <Text style={styles.headerTitle}>FAQ</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <XXLogoIcon />
          <Text style={styles.heading}>자주 묻는 질문</Text>

          <View style={styles.card}>
            {FAQS.map((faq, index) => {
              const open = openIndex === index;
              return (
                <View key={faq.question}>
                  {index > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={styles.row}
                    onPress={() => setOpenIndex(open ? null : index)}
                  >
                    <Text style={styles.question}>{faq.question}</Text>
                    <View style={open ? styles.chevronOpen : undefined}>
                      <ChevronDownIcon size={16} />
                    </View>
                  </Pressable>
                  {open && <Text style={styles.answer}>{faq.answer}</Text>}
                </View>
              );
            })}
          </View>

          <Text style={styles.footNote}>
            더 궁금한 점이 있으면 마이 페이지의 보호자 이메일로 문의를 남겨주세요.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
header: { ...headerBar, paddingHorizontal: 12 },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#000000",
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
  headerSpacer: { width: 24 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 25,
    paddingBottom: 32,
  },
  heading: {
    marginTop: 12,
    marginBottom: 12,
    color: "#4C4C4C",
    fontSize: 18,
    fontFamily: "Pretendard-SemiBold",
  },
  card: {
    backgroundColor: "#FFFCFD",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 3px 3px rgba(0, 0, 0, 0.06)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  question: {
    flex: 1,
    color: "#111111",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Pretendard-Medium",
  },
  // 접혀 있을 땐 아래, 펼치면 위를 가리킨다.
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  answer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -4,
    color: "#707070",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Pretendard-Regular",
  },
  divider: {
    height: 1,
    marginLeft: 16,
    backgroundColor: "#F1E3E8",
  },
  footNote: {
    marginTop: 16,
    marginLeft: 2,
    color: "#A0A0A0",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Pretendard-Regular",
  },
});
