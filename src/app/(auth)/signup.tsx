import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { BackChevronIcon, RequiredDot, XXLogoIcon } from "@/components/icons";
import { savePregnancyInfo } from "@/lib/pregnancy";

const PREGNANCY_WEEKS = Array.from({ length: 42 }, (_, i) => i + 1);

// Figma: 회원가입 / 회원가입_입력 시 텍스트
// 이름, 아이디, 비밀번호, 임신 정보, 휴대폰 번호, 본인/보호자 이메일 입력 폼.
// 두 프레임은 입력 전/후 상태 차이일 뿐이라 화면 하나에서
// 폼 상태로 처리한다 (플레이스홀더 vs 입력값 텍스트).
export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [ownEmail, setOwnEmail] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [pregnancyWeek, setPregnancyWeek] = useState(1);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);

  const canSubmit = Boolean(
    name.trim() && id.trim() && password.trim() && phone.trim() && ownEmail.trim()
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FFFCFD", "#FFEBF3"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* 뒤로가기(top:66)와 XX 로고(top:113)는 같은 줄이 아니라
            세로로 쌓인 별개 요소라 header를 column으로 구성한다. */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <BackChevronIcon />
          </Pressable>
          <View style={styles.logo}>
            <XXLogoIcon width={65} height={24} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <FieldLabel text="이름" required />
          <TextInput
            style={[styles.field, styles.fieldSpacingTight]}
            placeholder="김더블"
            placeholderTextColor="#A0A0A0"
            value={name}
            onChangeText={setName}
          />

          <FieldLabel text="아이디" required />
          <TextInput
            style={[styles.field, styles.fieldSpacingTight]}
            placeholder="아이디 입력"
            placeholderTextColor="#A0A0A0"
            autoCapitalize="none"
            autoCorrect={false}
            value={id}
            onChangeText={setId}
          />

          <FieldLabel text="비밀번호" required />
          <TextInput
            style={[styles.field, styles.fieldSpacingTight]}
            placeholder="비밀번호 입력"
            placeholderTextColor="#A0A0A0"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
          />

          <FieldLabel text="임신 정보" required />
          <View style={styles.fieldSpacingTight}>
            <Pressable
              style={styles.weekSelect}
              onPress={() => setWeekPickerOpen(true)}
            >
              <Text style={styles.weekSelectLabel} numberOfLines={1}>
                임신 주차 선택
              </Text>
              <Text style={styles.weekSelectValue}>{pregnancyWeek}</Text>
            </Pressable>
          </View>

          <FieldLabel text="휴대폰 번호" required />
          <TextInput
            style={[styles.field, styles.fieldSpacingTight]}
            placeholder="010-1234-5678"
            placeholderTextColor="#A0A0A0"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <FieldLabel text="이메일" />
          <View style={[styles.emailField, styles.fieldSpacingEmail]}>
            <View style={styles.emailLabelRow}>
              <Text style={styles.emailLabel}>본인 이메일</Text>
              <RequiredDot />
            </View>
            <TextInput
              style={styles.emailInput}
              placeholder="DoubleX@gmail.com"
              placeholderTextColor="#A0A0A0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={ownEmail}
              onChangeText={setOwnEmail}
            />
          </View>

          <View style={[styles.emailField, styles.fieldSpacingTight2]}>
            <Text style={styles.emailLabel}>보호자 이메일</Text>
            <TextInput
              style={styles.emailInput}
              placeholder="DoubleX@gmail.com"
              placeholderTextColor="#A0A0A0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={guardianEmail}
              onChangeText={setGuardianEmail}
            />
          </View>

          <Text style={styles.caption}>
            *보호자 이메일 입력 시 분석 결과를 보호자와 공유할 수 있습니다.
          </Text>
        </ScrollView>

        <View style={styles.bottomArea}>
          <Pressable
            style={[styles.submitButton, canSubmit && styles.submitButtonEnabled]}
            disabled={!canSubmit}
            onPress={async () => {
              // 캘린더의 주차 표시는 여기서 저장한 값을 기준으로 계산된다.
              await savePregnancyInfo(pregnancyWeek);
              router.replace("/home");
            }}
          >
            <Text style={styles.submitButtonText}>완료</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <Modal
        visible={weekPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setWeekPickerOpen(false)}
      >
        <View style={styles.modalContainer}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setWeekPickerOpen(false)}
          />
          <SafeAreaView style={styles.modalSheet} edges={["bottom"]}>
            <Text style={styles.modalTitle}>임신 주차 선택</Text>
            <FlatList
              data={PREGNANCY_WEEKS}
              keyExtractor={(week) => String(week)}
              style={styles.modalList}
              renderItem={({ item: week }) => {
                const selected = week === pregnancyWeek;
                return (
                  <Pressable
                    style={styles.weekOption}
                    onPress={() => {
                      setPregnancyWeek(week);
                      setWeekPickerOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.weekOptionText,
                        selected && styles.weekOptionTextSelected,
                      ]}
                    >
                      {week}주차
                    </Text>
                  </Pressable>
                );
              }}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.labelText}>{text}</Text>
      {required && <RequiredDot />}
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
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  logo: {
    marginTop: 23,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  labelText: {
    color: "#111111",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    lineHeight: 18.2,
  },
  field: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: "#A0A0A0",
    backgroundColor: "#FFFCFD",
    paddingHorizontal: 17,
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: "#111111",
  },
  fieldSpacingTight: {
    marginBottom: 14,
  },
  weekSelect: {
    width: 117,
    height: 60,
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: "#A0A0A0",
    backgroundColor: "#FFFCFD",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  weekSelectLabel: {
    color: "#707070",
    fontSize: 11,
    fontFamily: "Pretendard-Medium",
    lineHeight: 14,
  },
  weekSelectValue: {
    marginTop: 4,
    color: "#111111",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    lineHeight: 18.2,
  },
  emailField: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: "#A0A0A0",
    backgroundColor: "#FFFCFD",
    paddingHorizontal: 19,
    paddingTop: 10,
  },
  fieldSpacingEmail: {
    marginBottom: 10,
  },
  fieldSpacingTight2: {
    marginBottom: 8,
  },
  emailLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emailLabel: {
    color: "#707070",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    lineHeight: 18.2,
  },
  emailInput: {
    marginTop: 3,
    padding: 0,
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: "#111111",
  },
  caption: {
    marginTop: 8,
    marginLeft: 2,
    color: "#FA0C56",
    fontSize: 12,
    fontFamily: "Pretendard-Medium",
    lineHeight: 15.6,
  },
  bottomArea: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  submitButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#A0A0A0",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonEnabled: {
    backgroundColor: "#FA0C56",
  },
  submitButtonText: {
    color: "#FFFDF9",
    fontSize: 20,
    fontFamily: "Pretendard-SemiBold",
    lineHeight: 26,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    maxHeight: "60%",
    backgroundColor: "#FFFCFD",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
  },
  modalTitle: {
    textAlign: "center",
    color: "#111111",
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
    marginBottom: 8,
  },
  modalList: {
    paddingHorizontal: 16,
  },
  weekOption: {
    height: 48,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F5E9EE",
  },
  weekOptionText: {
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: "#707070",
  },
  weekOptionTextSelected: {
    color: "#FA0C56",
    fontFamily: "Pretendard-SemiBold",
  },
});
