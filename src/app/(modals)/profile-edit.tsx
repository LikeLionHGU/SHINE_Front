import { useEffect, useState } from "react";
import { headerBar } from "@/lib/theme";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BackChevronIcon, XXLogoIcon } from "@/components/icons";
import { getUserProfile, updateUserProfile, type UserProfile } from "@/lib/api";

/** 수정할 수 있는 칸. 마이 페이지에서 어떤 줄을 눌렀는지에 따라 처음 포커스가 간다. */
type FieldKey = "name" | "phone" | "email" | "guardianEmail" | "extraEmail";

const FIELDS: { key: FieldKey; label: string; placeholder: string; keyboard: "default" | "phone-pad" | "email-address"; note?: string }[] = [
  { key: "name", label: "이름", placeholder: "김더블", keyboard: "default" },
  { key: "phone", label: "연락처", placeholder: "010-1234-5678", keyboard: "phone-pad" },
  { key: "email", label: "본인 이메일", placeholder: "DoubleX@gmail.com", keyboard: "email-address" },
  {
    key: "guardianEmail",
    label: "보호자 이메일",
    placeholder: "DoubleX@gmail.com",
    keyboard: "email-address",
    note: "입력하면 분석 결과를 보호자와 공유할 수 있어요.",
  },
  { key: "extraEmail", label: "추가 이메일", placeholder: "DoubleX@gmail.com", keyboard: "email-address" },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 서버(UserUpdateRequest)가 쓰는 규칙과 같은 형식.
const PHONE = /^[+0-9][0-9 -]{7,19}$/;

// 마이 페이지 > 개인정보 수정.
// 서버는 보낸 칸만 바꾸므로(PATCH), 실제로 값이 달라진 칸만 골라 보낸다.
export default function ProfileEdit() {
  const router = useRouter();
  const { field } = useLocalSearchParams<{ field?: FieldKey }>();

  // 원본은 "무엇이 바뀌었는지" 비교하는 데 쓴다.
  const [original, setOriginal] = useState<UserProfile | null>(null);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: "",
    phone: "",
    email: "",
    guardianEmail: "",
    extraEmail: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getUserProfile().then((profile) => {
      if (!active) return;
      setOriginal(profile);
      setValues({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        email: profile.email ?? "",
        guardianEmail: profile.guardianEmail ?? "",
        extraEmail: profile.extraEmail ?? "",
      });
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/settings");
  }

  /** 서버 규칙에 맞는지 먼저 본다. 서버는 어느 칸이 틀렸는지 알려주지 않는다. */
  function validate() {
    if (!values.name.trim()) return "이름을 입력해주세요.";
    if (!PHONE.test(values.phone.trim()))
      return "연락처를 다시 확인해주세요. (예: 010-1234-5678)";
    if (!EMAIL.test(values.email.trim())) return "본인 이메일 형식을 다시 확인해주세요.";
    if (values.guardianEmail.trim() && !EMAIL.test(values.guardianEmail.trim()))
      return "보호자 이메일 형식을 다시 확인해주세요.";
    if (values.extraEmail.trim() && !EMAIL.test(values.extraEmail.trim()))
      return "추가 이메일 형식을 다시 확인해주세요.";
    return "";
  }

  /** 값이 실제로 달라진 칸만 모은다. 하나도 없으면 저장할 것이 없다. */
  function collectChanges() {
    if (!original) return {};
    const before: Record<FieldKey, string> = {
      name: original.name ?? "",
      phone: original.phone ?? "",
      email: original.email ?? "",
      guardianEmail: original.guardianEmail ?? "",
      extraEmail: original.extraEmail ?? "",
    };
    const changes: Partial<Record<FieldKey, string>> = {};
    for (const key of Object.keys(values) as FieldKey[]) {
      if (values[key].trim() !== before[key].trim()) changes[key] = values[key].trim();
    }
    return changes;
  }

  const changed = Object.keys(collectChanges()).length > 0;

  async function handleSave() {
    if (saving) return;
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    const changes = collectChanges();
    if (Object.keys(changes).length === 0) {
      goBack();
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateUserProfile(changes);
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FFFCFD", "#FFEBF3"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={goBack} hitSlop={8}>
            <BackChevronIcon color="#111111" />
          </Pressable>
          <Text style={styles.headerTitle}>개인정보 수정</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <XXLogoIcon />
          <Text style={styles.heading}>개인정보</Text>

          {loading ? (
            <Text style={styles.loadingText}>불러오는 중이에요.</Text>
          ) : (
            <View style={styles.card}>
              {FIELDS.map((item, index) => (
                <View key={item.key}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.field}>
                    <Text style={styles.label}>{item.label}</Text>
                    <TextInput
                      style={styles.input}
                      value={values[item.key]}
                      onChangeText={(text) =>
                        setValues((prev) => ({ ...prev, [item.key]: text }))
                      }
                      placeholder={item.placeholder}
                      placeholderTextColor="#A0A0A0"
                      keyboardType={item.keyboard}
                      autoCapitalize="none"
                      autoCorrect={false}
                      // 마이 페이지에서 누른 줄에 커서를 먼저 둔다.
                      autoFocus={field === item.key}
                    />
                    {item.note && <Text style={styles.note}>{item.note}</Text>}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.footNote}>
            아이디와 비밀번호는 여기서 바꿀 수 없어요.
          </Text>
        </ScrollView>

        <View style={styles.bottomArea}>
          {error !== "" && <Text style={styles.errorText}>{error}</Text>}
          <Pressable
            style={[styles.saveButton, changed && !saving && styles.saveButtonEnabled]}
            disabled={loading || saving || !changed}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>{saving ? "저장 중..." : "저장"}</Text>
          </Pressable>
        </View>
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
    paddingBottom: 24,
  },
  heading: {
    marginTop: 12,
    marginBottom: 12,
    color: "#4C4C4C",
    fontSize: 18,
    fontFamily: "Pretendard-SemiBold",
  },
  loadingText: {
    paddingVertical: 24,
    color: "#A0A0A0",
    fontSize: 14,
    fontFamily: "Pretendard-Regular",
  },
  card: {
    backgroundColor: "#FFFCFD",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 3px 3px rgba(0, 0, 0, 0.06)",
  },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  label: {
    color: "#707070",
    fontSize: 12,
    fontFamily: "Pretendard-Medium",
  },
  input: {
    padding: 0,
    color: "#111111",
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
  note: {
    marginTop: 2,
    color: "#A0A0A0",
    fontSize: 11,
    lineHeight: 16,
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
  saveButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#A0A0A0",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonEnabled: { backgroundColor: "#FA0C56" },
  saveButtonText: {
    color: "#FFFDF9",
    fontSize: 20,
    fontFamily: "Pretendard-SemiBold",
    lineHeight: 26,
    letterSpacing: 1.2,
  },
});
