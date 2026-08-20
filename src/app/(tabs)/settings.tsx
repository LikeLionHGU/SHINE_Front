import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import {
  BackChevronIcon,
  BellIcon,
  CameraIcon,
  ChevronRightIcon,
  DocumentIcon,
  EditPencilIcon,
  FaqIcon,
  GearIcon,
  ToggleSwitch,
  XXLogoIcon,
} from "@/components/icons";
import { getUserProfile, logout, type UserProfile } from "@/lib/api";

// Figma: 환경설정 (바텀탭 "마이")
// 프로필 카드, 개인정보(연락처/이메일), 기본 설정(카메라 동의/알림/FAQ/이용약관/환경설정).
export default function Settings() {
  const router = useRouter();
  const [cameraConsent, setCameraConsent] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // 개인정보 수정 화면에서 돌아오면 바뀐 값이 바로 보여야 한다.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getUserProfile().then((value) => {
        if (active) setProfile(value);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  /** 개인정보 수정으로 이동. 누른 줄에 커서를 먼저 두도록 field를 넘긴다. */
  const editProfile = (field: string) =>
    router.push({ pathname: "/(modals)/profile-edit", params: { field } });

  // 서버 호출이 실패해도 기기의 토큰은 지워지므로(logout 내부에서 처리) 항상 로그인 화면으로 보낸다.
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace("/login");
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#FFFCFD", "#FFEBF3"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <BackChevronIcon color="#111111" />
          </Pressable>
          <Text style={styles.headerTitle}>마이</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <XXLogoIcon width={46} height={17} />

          <Text style={styles.sectionTitle}>프로필</Text>
          <Pressable style={[styles.card, styles.profileCard]} onPress={() => editProfile("name")}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>XX</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.name ?? ""}</Text>
              <Text style={styles.profileSubtitle}>
                {profile?.accountName ?? ""}
              </Text>
            </View>
            <ChevronRightIcon />
          </Pressable>

          <Text style={styles.sectionTitle}>개인정보</Text>
          <View style={[styles.card, styles.infoCard]}>
            <Pressable
              style={[styles.infoRow, styles.infoRowToDivider]}
              onPress={() => editProfile("phone")}
            >
              <Text style={styles.infoLabel}>연락처 정보</Text>
              <Text style={styles.infoValueAuto}>{profile?.phone ?? ""}</Text>
              <View style={styles.infoSpacer} />
              <ChevronRightIcon size={20} />
            </Pressable>
            <View style={styles.dividerSpaced} />
            <Pressable
              style={[styles.infoRow, styles.infoRowSpacing]}
              onPress={() => editProfile("email")}
            >
              <Text style={styles.infoLabel}>본인 이메일</Text>
              <Text style={styles.infoValueAuto}>{profile?.email ?? ""}</Text>
              <EditPencilIcon />
            </Pressable>
            <Pressable
              style={[styles.infoRow, styles.infoRowSpacing]}
              onPress={() => editProfile("guardianEmail")}
            >
              <Text style={styles.infoLabel}>보호자 이메일</Text>
              <Text style={styles.infoValueAuto}>
                {profile?.guardianEmail ?? ""}
              </Text>
              <EditPencilIcon />
            </Pressable>
            <Pressable style={styles.infoRow} onPress={() => editProfile("extraEmail")}>
              <Text style={styles.infoLabel}>추가 이메일</Text>
              {profile?.extraEmail ? (
                <Text style={styles.infoValueAuto}>{profile.extraEmail}</Text>
              ) : (
                <View style={styles.addEmailPill} />
              )}
              <EditPencilIcon />
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>기본 설정</Text>
          <View style={[styles.card, styles.settingsCard]}>
            <View style={styles.settingsRow}>
              <CameraIcon size={22} />
              <Text style={styles.settingsLabel}>카메라 동의 여부</Text>
              <ToggleSwitch value={cameraConsent} onValueChange={setCameraConsent} />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingsRow}>
              <BellIcon size={22} />
              <Text style={styles.settingsLabel}>알림 설정</Text>
              <ToggleSwitch value={notifications} onValueChange={setNotifications} />
            </View>
            <View style={styles.divider} />
            <Pressable style={styles.settingsRow} onPress={() => router.push("/(modals)/faq")}>
              <FaqIcon size={22} />
              <Text style={styles.settingsLabel}>FAQ</Text>
              <ChevronRightIcon />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.settingsRow} onPress={() => router.push("/(modals)/terms")}>
              <DocumentIcon size={22} />
              <Text style={styles.settingsLabel}>이용약관</Text>
              <ChevronRightIcon />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.settingsRow}>
              <GearIcon size={22} />
              <Text style={styles.settingsLabel}>환경설정</Text>
              <ChevronRightIcon />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutButtonPressed]}
            disabled={loggingOut}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>{loggingOut ? "로그아웃 중..." : "로그아웃"}</Text>
          </Pressable>
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
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#000000",
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
  },
  headerSpacer: {
    width: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 25,
    paddingBottom: 32,
  },
  sectionTitle: {
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
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    gap: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 42,
    backgroundColor: "#FF0A68",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    textAlign: "center",
    color: "#FFFCFD",
    fontSize: 30,
    lineHeight: 42,
    fontFamily: "ZalandoSansExpanded_900Black",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: "#111111",
  },
  profileSubtitle: {
    marginTop: 2,
    fontSize: 16,
    fontFamily: "Pretendard-Medium",
    color: "#A0A0A0",
  },
  infoCard: {
    paddingHorizontal: 13,
    paddingTop: 15,
    paddingBottom: 9,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoRowToDivider: {
    marginBottom: 10,
  },
  infoRowSpacing: {
    marginBottom: 9,
  },
  infoLabel: {
    width: 79,
    fontSize: 12,
    fontFamily: "Pretendard-Medium",
    color: "#111111",
  },
  infoValueAuto: {
    fontSize: 14,
    fontFamily: "Pretendard-Medium",
    color: "#A0A0A0",
  },
  infoSpacer: {
    flex: 1,
  },
  addEmailPill: {
    flex: 1,
    height: 20,
    backgroundColor: "#FFF0F6",
    borderRadius: 50,
  },
  settingsCard: {
    paddingHorizontal: 20,
  },
  logoutButton: {
    marginTop: 24,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD9E8",
    backgroundColor: "#FFFCFD",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButtonPressed: { opacity: 0.7 },
  logoutText: {
    color: "#FA0C56",
    fontSize: 16,
    fontFamily: "Pretendard-SemiBold",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 20,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Pretendard-Regular",
    color: "#111111",
  },
  divider: {
    height: 0.5,
    marginLeft: 42,
    marginRight: -20,
    backgroundColor: "#A0A0A0",
  },
  dividerSpaced: {
    height: 0.5,
    marginLeft: 87,
    marginRight: -13,
    backgroundColor: "#A0A0A0",
    marginBottom: 9,
  },
});
