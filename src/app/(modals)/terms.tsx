import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useScrollToTop } from "@/lib/use-scroll-top";
import { headerBar } from "@/lib/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { BackChevronIcon, XXLogoIcon } from "@/components/icons";

/** 조항 하나. 제목 아래에 문단들이 들어간다. */
type Clause = { title: string; paragraphs: string[] };

const CLAUSES: Clause[] = [
  {
    title: "제1조 (목적)",
    paragraphs: [
      "이 약관은 DOUBLE X(이하 '서비스')가 제공하는 산전 검사지 기록·분석 기능의 이용 조건과 절차, 회원과 서비스의 권리와 의무를 정하는 것을 목적으로 합니다.",
    ],
  },
  {
    title: "제2조 (서비스의 성격)",
    paragraphs: [
      "서비스는 회원이 올린 산전 검사지를 읽기 쉬운 형태로 정리하고, 임신 중 참고 기준에 따른 정보를 함께 보여줍니다.",
      "서비스가 제공하는 모든 내용은 참고 정보이며 의료 행위가 아닙니다. 진단·처방·치료 여부는 반드시 의료진의 판단을 따라야 합니다.",
      "검사지 인식 결과는 사진 상태나 검사 항목에 따라 정확하지 않을 수 있습니다. 회원은 원본 검사지와 대조해 확인할 책임이 있습니다.",
    ],
  },
  {
    title: "제3조 (회원가입)",
    paragraphs: [
      "회원은 아이디, 비밀번호, 이름, 휴대폰 번호, 이메일, 임신 주차를 입력해 가입합니다.",
      "회원은 입력한 정보를 사실대로 유지해야 하며, 변경 사항은 마이 페이지에서 수정할 수 있습니다.",
      "회원의 계정과 비밀번호 관리 책임은 회원 본인에게 있습니다.",
    ],
  },
  {
    title: "제4조 (개인정보와 건강정보의 처리)",
    paragraphs: [
      "서비스는 검사지 이미지와 검사 결과, 임신 주차, 진료 일정을 회원에게 기록·분석 기능을 제공하기 위한 목적으로만 이용합니다.",
      "회원이 보호자 이메일을 입력하고 공유하기를 실행한 경우에 한해, 해당 주소로 일정과 분석 결과가 전달됩니다.",
      "회원은 언제든지 계정 삭제를 요청할 수 있으며, 삭제 시 보관 중인 검사지와 분석 결과도 함께 삭제됩니다.",
    ],
  },
  {
    title: "제5조 (회원의 의무)",
    paragraphs: [
      "회원은 본인의 검사지가 아닌 자료나 타인의 건강정보를 올려서는 안 됩니다.",
      "회원은 서비스를 통해 얻은 정보를 의료 자문이나 진단으로 오인하게 하는 방식으로 제3자에게 제공해서는 안 됩니다.",
    ],
  },
  {
    title: "제6조 (책임의 한계)",
    paragraphs: [
      "서비스는 검사지 인식 결과의 완전성과 정확성을 보장하지 않으며, 회원이 서비스 내용을 근거로 내린 판단에 대해 의료적 책임을 지지 않습니다.",
      "천재지변, 통신 장애 등 서비스가 통제할 수 없는 사유로 발생한 손해에 대해서는 책임이 면제됩니다.",
    ],
  },
  {
    title: "제7조 (약관의 변경)",
    paragraphs: [
      "서비스는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 앱 내 공지를 통해 알립니다.",
      "회원이 변경된 약관에 동의하지 않는 경우 이용을 중단하고 계정 삭제를 요청할 수 있습니다.",
    ],
  },
];

// 마이 페이지 > 기본 설정 > 이용약관.
// FAQ 화면과 같은 배경·카드 스타일을 쓰고, 조항을 위에서 아래로 읽어 내려가는
// 형태라 접고 펴는 동작은 두지 않았다.
export default function Terms() {
  // 화면에 들어올 때마다 스크롤을 맨 위로 되돌린다.
  const scrollRef = useScrollToTop();
  const router = useRouter();

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
          <Text style={styles.headerTitle}>이용약관</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <XXLogoIcon />
          <Text style={styles.heading}>서비스 이용약관</Text>
          <Text style={styles.updated}>최종 수정일 2026. 08. 20</Text>

          <View style={styles.card}>
            {CLAUSES.map((clause, index) => (
              <View key={clause.title}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.clause}>
                  <Text style={styles.clauseTitle}>{clause.title}</Text>
                  {clause.paragraphs.map((paragraph, i) => (
                    <Text key={i} style={styles.paragraph}>
                      {paragraph}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.footNote}>
            이 약관은 서비스 이용을 시작한 시점부터 적용됩니다.
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
    marginBottom: 4,
    color: "#4C4C4C",
    fontSize: 18,
    fontFamily: "Pretendard-SemiBold",
  },
  updated: {
    marginBottom: 12,
    color: "#A0A0A0",
    fontSize: 12,
    fontFamily: "Pretendard-Regular",
  },
  card: {
    backgroundColor: "#FFFCFD",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 3px 3px rgba(0, 0, 0, 0.06)",
  },
  clause: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  clauseTitle: {
    color: "#111111",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Pretendard-SemiBold",
  },
  paragraph: {
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
