import {
  BackChevronIcon,
  CameraIcon,
  CloseIcon,
  UploadCloudIcon,
  XXLogoIcon,
} from "@/components/icons";
import { useScrollToTop } from "@/lib/use-scroll-top";
import { centeredContentStyle, centeredSheetStyle } from "@/lib/layout";
import { cardShadow, colors, font, headerBar, radius, tracking, type as t } from "@/lib/theme";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type PickMethod = "camera" | "library";

// Figma(node 837:4597 선택 상태 / 837:4567 사진 불러온 상태): 검사지 분석 1단계.
// "사진 찍기"는 네이티브 카메라를, "사진 불러오기"는 사진 보관함을 바로 띄운다.
// 사진이 선택되면 같은 화면에 미리보기 + "완료" 버튼이 나타나고, 완료를 누르면
// analyzing 화면으로 넘어가 스캔 애니메이션 후 결과 화면으로 이동한다.
export default function ScanStart() {
  // 화면에 들어올 때마다 스크롤을 맨 위로 되돌린다.
  const scrollRef = useScrollToTop();
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [method, setMethod] = useState<PickMethod | null>(null);
  async function pickFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("카메라 권한이 필요해요", "설정에서 카메라 접근을 허용해주세요.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setMethod("camera");
    }
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("사진 보관함 권한이 필요해요", "설정에서 사진 접근을 허용해주세요.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setMethod("library");
    }
  }

  function handleClose() {
    // 홈에서 "올리기"로 들어오면 뒤로 갈 화면이 있지만, 주소로 바로 열거나
    // 분석 화면에서 replace·dismissTo로 넘어온 경우엔 히스토리가 없어 back()이
    // 아무 일도 하지 않는다. 그때는 홈으로 보낸다.
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  }

  function handleComplete() {
    if (!imageUri) return;
    router.push({ pathname: "/(modals)/scan/date-confirm", params: { uri: imageUri } });
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={[colors.bgFrom, colors.bgTo]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={handleClose} accessibilityRole="button" accessibilityLabel="뒤로">
            <BackChevronIcon size={24} />
          </Pressable>
          {/* Figma 837:4594 — 뒤로가기와 짝을 이루는 닫기 버튼. 스캔을 중간에
              그만둘 때 홈으로 바로 빠져나가는 길이 없어서 빠져 있었다. */}
          <Pressable hitSlop={8} onPress={handleClose} accessibilityRole="button" accessibilityLabel="닫기">
            <CloseIcon size={24} />
          </Pressable>
        </View>

        <ScrollView ref={scrollRef} style={centeredContentStyle} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <XXLogoIcon />
          <Text style={styles.heading}>산전 검사지를{"\n"}업로드 해주세요</Text>

          <View style={styles.cardsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.card,
                method === "camera" && imageUri ? styles.cardSelected : null,
                pressed && styles.pressed,
              ]}
              onPress={pickFromCamera}
            >
              <CameraIcon size={24} />
              <Text style={styles.cardLabel}>사진 찍기</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.card,
                method === "library" && imageUri ? styles.cardSelected : null,
                pressed && styles.pressed,
              ]}
              onPress={pickFromLibrary}
            >
              <UploadCloudIcon size={24} />
              <Text style={styles.cardLabel}>사진 불러오기</Text>
            </Pressable>
          </View>

          {imageUri && (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          )}
        </ScrollView>

        {imageUri && (
          <Pressable
            style={({ pressed }) => [centeredSheetStyle, styles.completeButton, pressed && styles.pressed]}
            onPress={handleComplete}
          >
            <Text style={styles.completeButtonText}>완료</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  );
}

const CORNER_SIZE = 18;
/** ㄱ자 모서리 안쪽 미리보기 틀의 고정 높이. 폭은 콘텐츠 폭을 그대로 쓴다. */
const PREVIEW_HEIGHT = 320;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
header: { ...headerBar, justifyContent: "space-between", paddingHorizontal: 16 },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, gap: 12 },
  // Figma 837:4570 — 24/32, 자간 -0.72. (홈 대제목만 줄 단위로 -0.64가 따로 걸려 있다.)
  heading: { marginTop: -8, marginBottom: 4, ...t.heading24, letterSpacing: tracking(24) },
  // Figma: 카드 left 15 / 201, 폭 176 → 사이 간격 10
  cardsRow: { flexDirection: "row", gap: 10 },
  card: {
    flex: 1,
    height: 74,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    // Figma 837:4572 — 아이콘과 라벨 사이 16
    gap: 16,
    ...cardShadow,
  },
  // 선택된 카드는 3px 핑크 테두리로 바뀌고 그림자는 빠진다(Figma 837:4575).
  cardSelected: {
    borderWidth: 3,
    borderColor: colors.brandStrong,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: { opacity: 0.78 },
  cardLabel: { fontFamily: font.medium, fontSize: 16, lineHeight: 21, letterSpacing: tracking(16), color: colors.text },
  // ㄱ자 모서리로 감싸는 미리보기 틀은 항상 같은 크기다. 사진 비율에 따라
  // 틀이 늘었다 줄었다 하면 아래 "완료" 버튼과 여백이 매번 달라 보인다.
  // 안쪽 사진만 contain으로 맞춰서, 세로 사진이든 가로 사진이든 잘리지 않고
  // 이 틀 안에 자유롭게 들어간다.
  previewWrap: {
    marginTop: 12,
    alignSelf: "center",
    width: "100%",
    height: PREVIEW_HEIGHT,
  },
  preview: {
    width: "100%",
    height: "100%",
    borderRadius: radius.sm,
    backgroundColor: colors.surfacePink,
  },
  corner: { position: "absolute", width: CORNER_SIZE, height: CORNER_SIZE, borderColor: colors.textSub },
  cornerTL: { top: -8, left: -8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  cornerTR: { top: -8, right: -8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 },
  cornerBL: { bottom: -8, left: -8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: -8, right: -8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 6 },
  // Figma 588:5552 — 361×46, r12, #FA0C56. 글자만 자간이 양수(+1.2)라
  // 본문 규칙(-3%)을 따르지 않는다. 버튼 텍스트라 일부러 벌려둔 값이므로 그대로 둔다.
  completeButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.brandStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  completeButtonText: {
    color: "#FFFDF9",
    fontFamily: font.semiBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 1.2,
  },
});
