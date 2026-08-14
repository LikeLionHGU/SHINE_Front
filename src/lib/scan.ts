import * as ImageManipulator from "expo-image-manipulator";

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
