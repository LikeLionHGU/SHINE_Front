import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";

// 검사지 사진을 "스캔한 문서"로 바꾸는 실제 처리.
// 진짜 문서 스캐너/OCR SDK(에지 감지·원근 보정 등)를 붙이기 전까지,
// 여기서 실질적으로 하는 일은:
// 1) 사진의 EXIF 방향을 실제 픽셀에 반영해 카메라로 찍은 사진이 옆으로
//    눕거나 뒤집혀 보이는 문제를 없애고,
// 2) 리사이즈 없이 사용자가 찍은/불러온 사진 그대로의 크기를 유지한 채,
// 3) 새 JPEG로 저장한다.
// 실제 "스캔된 문서처럼 흑백/고대비로 보이는" 룩은 이 결과 이미지에
// 화면단 필터 스타일을 얹어서 표현한다 — analysis/report.tsx의
// SCAN_FILTER_STYLE 참고.
export async function scanDocumentImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    // 크기를 바꾸는 action은 넣지 않는다 — 빈 배열이어도 EXIF 방향은
    // 픽셀에 반영된 채로 다시 저장되고, 원본 가로/세로 크기는 그대로 유지된다.
    [],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

/**
 * 서버로 보낼 검사지 사진을 줄인다.
 *
 * 화면에 그릴 때는 원본을 그대로 쓰지만, 업로드는 다르다. 요즘 폰 카메라는
 * 한 장이 5~10MB라 모바일 데이터에서 자주 실패하고, 성공해도 저장 버튼을 누른
 * 뒤 한참 기다리게 된다. 긴 변 2000px·JPEG 80%면 A4 검사지의 작은 글씨까지
 * 사람이 읽을 수 있으면서 보통 1MB 아래로 떨어진다.
 *
 * 이 사진은 "내가 올린 종이와 대조하는 용도"라 이 정도면 충분하다.
 * (판정에 쓰는 OCR은 업로드 전 원본으로 이미 끝나 있다.)
 *
 * 압축에 실패하면 원본 uri를 그대로 돌려준다 — 사진이 안 올라가는 것보다
 * 크더라도 올라가는 편이 낫다.
 */
const UPLOAD_MAX_EDGE = 2000;

export async function compressForUpload(uri: string): Promise<string> {
  try {
    const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve(null),
      );
    });

    const actions: ImageManipulator.Action[] = [];
    if (size && Math.max(size.width, size.height) > UPLOAD_MAX_EDGE) {
      // 긴 변만 지정하면 짧은 변은 비율에 맞춰 따라온다.
      actions.push(
        size.width >= size.height
          ? { resize: { width: UPLOAD_MAX_EDGE } }
          : { resize: { height: UPLOAD_MAX_EDGE } },
      );
    }

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  } catch (error) {
    console.warn("[scan] 업로드용 압축 실패, 원본으로 보냅니다:", error);
    return uri;
  }
}
