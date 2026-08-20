import { useState } from "react";
import { headerBar } from "@/lib/theme";
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
import { useRouter } from "expo-router";
import {
  BackChevronIcon,
  ChevronDownIcon,
  RequiredDot,
  XXLogoIcon,
} from "@/components/icons";
import { signup } from "@/lib/api";

const PREGNANCY_WEEKS = Array.from({ length: 42 }, (_, i) => i + 1);

/** 하이픈이 들어간 형태의 최대 길이(010-1234-5678). */
const PHONE_MAX_LENGTH = 13;

/**
 * 입력값에서 숫자만 남긴 뒤 010-1234-5678 형태로 하이픈을 넣어준다.
 * 붙여넣기("01012345678")든 한 자씩 치는 중이든 같은 규칙을 쓰고,
 * 사용자가 하이픈을 직접 지워도 숫자만 다시 읽어 재구성한다.
 *
 * 휴대폰 번호 전용 필드라 3-4-4로 고정한다 — 타이핑 도중 3-3-4로
 * 끊었다가 11번째 자리에서 다시 3-4-4로 재배치되면 커서가 튀어 보인다.
 */
function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

// Figma: 회원가입 / 회원가입_입력 시 텍스트
// 이름, 아이디, 비밀번호, 임신 정보, 휴대폰 번호, 본인/보호자 이메일 입력 폼.
// 두 프레임은 입력 전/후 상태 차이일 뿐이라 화면 하나에서
// 폼 상태로 처리한다 (플레이스홀더 vs 입력값 텍스트).
export default function Signup() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
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

  /**
   * 서버가 요구하는 형식을 눌러보기 전에 먼저 확인한다.
   *
   * 서버는 어느 칸이 틀렸는지 알려주지 않고 "입력값이 올바르지 않습니다." 한 줄만
   * 돌려주기 때문에, 그대로 두면 사용자가 무엇을 고쳐야 할지 알 수 없다.
   * 규칙은 백엔드 명세(SignupRequest)와 맞춰둔 것이라, 서버 규칙이 바뀌면
   * 여기도 같이 고쳐야 한다.
   */
  const validate = () => {
    if (!/^[a-z0-9]{4,20}$/.test(id.trim()))
      return "아이디는 영문 소문자와 숫자로 4~20자여야 해요.";
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,30}$/.test(password))
      return "비밀번호는 영문과 숫자를 모두 포함해 8자 이상이어야 해요.";
    if (!/^[+0-9][0-9 -]{7,19}$/.test(phone.trim()))
      return "휴대폰 번호를 다시 확인해주세요. (예: 010-1234-5678)";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownEmail.trim()))
      return "이메일 형식을 다시 확인해주세요.";
    if (guardianEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim()))
      return "보호자 이메일 형식을 다시 확인해주세요.";
    return "";
  };

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
            <XXLogoIcon />
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
          {/* 필드 바로 아래로 펼쳐지는 드롭다운 */}
          <View style={[styles.fieldSpacingTight, styles.weekSelectWrap]}>
            <Pressable
              style={styles.weekSelect}
              onPress={() => setWeekPickerOpen((open) => !open)}
            >
              <Text style={styles.weekSelectLabel} numberOfLines={1}>
                임신 주차 선택
              </Text>
              <View style={styles.weekSelectValueRow}>
                <Text style={styles.weekSelectValue}>{pregnancyWeek}</Text>
                <View style={weekPickerOpen && styles.chevronFlipped}>
                  <ChevronDownIcon size={16} />
                </View>
              </View>
            </Pressable>

            {weekPickerOpen && (
              <View style={styles.weekDropdown}>
                <ScrollView
                  style={styles.weekDropdownList}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {PREGNANCY_WEEKS.map((week) => {
                    const selected = week === pregnancyWeek;
                    return (
                      <Pressable
                        key={week}
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
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          <FieldLabel text="휴대폰 번호" required />
          <TextInput
            style={[styles.field, styles.fieldSpacingTight]}
            placeholder="010-1234-5678"
            placeholderTextColor="#A0A0A0"
            keyboardType="phone-pad"
            maxLength={PHONE_MAX_LENGTH}
            value={phone}
            onChangeText={(text) => setPhone(formatPhone(text))}
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
          {error !== "" && <Text style={styles.errorText}>{error}</Text>}
          <Pressable
            style={[styles.submitButton, canSubmit && styles.submitButtonEnabled]}
            disabled={!canSubmit || submitting}
            onPress={async () => {
              if (submitting) return;
              const invalid = validate();
              if (invalid) {
                setError(invalid);
                return;
              }
              setSubmitting(true);
              setError("");
              try {
                // 캘린더의 주차 표시는 여기서 보낸 주차를 기준으로 계산된다.
                await signup({
                  name,
                  accountId: id,
                  password,
                  phone,
                  email: ownEmail,
                  guardianEmail,
                  pregnancyWeek,
                });
                router.replace("/home");
              } catch (e) {
                // 아이디 중복(DUPLICATE_LOGIN_ID)·검증 실패 등 서버 메시지를 그대로 보여준다.
                setError(e instanceof Error ? e.message : "회원가입에 실패했어요.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Text style={styles.submitButtonText}>{submitting ? "가입 중..." : "완료"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
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
header: { ...headerBar, paddingHorizontal: 16 },
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
  weekSelectWrap: {
    position: "relative",
    zIndex: 20,
  },
  weekSelect: {
    width: 117,
    height: 60,
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: "#A0A0A0",
    backgroundColor: "#FFFCFD",
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  weekSelectValueRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chevronFlipped: {
    transform: [{ rotate: "180deg" }],
  },
  weekSelectLabel: {
    color: "#707070",
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    lineHeight: 18.2,
  },
  weekSelectValue: {
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
  errorText: {
    marginBottom: 8,
    textAlign: "center",
    color: "#FA0C56",
    fontSize: 13,
    fontFamily: "Pretendard-Medium",
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
  // 드롭다운은 필드 아래에 겹쳐 떠야 하므로 다른 입력칸보다 위에 그린다.
  weekDropdown: {
    position: "absolute",
    top: 64,
    left: 0,
    width: 117,
    maxHeight: 220,
    backgroundColor: "#FFFCFD",
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: "#A0A0A0",
    overflow: "hidden",
    zIndex: 20,
    elevation: 6,
  },
  weekDropdownList: {
    paddingHorizontal: 12,
  },
  weekOption: {
    height: 40,
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
