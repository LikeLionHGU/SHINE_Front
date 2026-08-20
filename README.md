
# SHINE

임신부가 산전검사 결과지를 스스로 이해할 수 있게 돕는 앱입니다.

검사지 사진 한 장을 찍으면 항목별로 판정하고, 왜 그런 판정인지 학회 원문까지 함께 보여줍니다.

백엔드: https://github.com/LikeLionHGU/SHINE_Backend

<br/>

## 이 앱이 하는 일

산전검사지에는 숫자와 영문 약어가 스무 줄쯤 적혀 있습니다. 옆에 인쇄된 참고치는 임신하지 않은 성인 기준이라, 임신부가 자기 결과를 판단하는 데 그대로 쓸 수 없습니다.

예를 들어 혈색소가 `10.8 g/dL` 이면 검사지에 인쇄된 `12.0~16.0` 을 벗어나 빈혈처럼 보입니다. 하지만 임신 중에는 혈장량이 늘어 수치가 자연히 희석되고, ACOG 기준 하한은 분기에 따라 `11.0 / 10.5 / 11.0 g/dL` 입니다. 반대로 검사지 기준으로는 정상인데 임신 중 기준으로는 상담이 필요한 항목도 있습니다.

SHINE은 이 간극을 메웁니다.

| 화면 | 하는 일 |
|---|---|
| 촬영 | 검사지를 찍으면 항목·수치·단위·참고치를 읽어냅니다 |
| 결과 | 항목별 판정과 근거, 학회 원문 링크를 보여줍니다 |
| 기록 | 지난 검사지를 날짜순으로 모아 봅니다 |
| 분석 | 항목별 수치 변화를 그래프로 그립니다 |
| 캘린더 | 진료 일정과 그때 물어볼 질문을 함께 관리합니다 |

판정은 네 가지로 나옵니다.

| 상태 | 뜻 |
|---|---|
| 안심 | 임신 주수 기준 범위 안입니다 |
| 주의 | 기준을 벗어났거나 재검이 필요합니다 |
| 위험 | 담당 의료진과 바로 상의해야 합니다 |
| 확인 필요 | 값을 읽지 못했거나, 판정 기준이 없는 항목입니다 |

<br/>

## 기술 스택

| 구분 | 사용 |
|---|---|
| 프레임워크 | React Native 0.86, Expo 57, Expo Router |
| 언어 | TypeScript |
| 저장 | AsyncStorage (인증 토큰) |
| 그래픽 | react-native-svg, Reanimated, expo-linear-gradient |
| 카메라 · 이미지 | expo-image-picker, expo-image-manipulator |
| 외부 API | OpenAI — `gpt-4o` OCR, `gpt-4o-mini` 요약 (서버 프록시 경유) |

<br/>

## 판정 엔진 — `src/lib/labs`

이 레포의 핵심입니다. **판정은 AI가 하지 않습니다.**

```
검사지 사진
   → OCR (gpt-4o)   표를 읽어 항목명·값·단위·참고치를 옮겨 적습니다
   → normalize      표기 흔들림·단위·정성 표기를 정리합니다
   → evaluate       기준표를 lookup 해 판정합니다
   → bridge         엔진 상태 7종을 화면 상태 4종으로 접습니다
   → 판정 + 근거 + 출처 + 추천 질문
```

LLM은 사진에서 글자를 옮겨 적고, 이미 정해진 판정 안에서 요약 문장을 쓰는 데만 씁니다. 수치 판정은 전부 코드가 기준표를 찾아 계산합니다.

같은 검사지를 두 번 올리면 같은 답이 나와야 하고, 왜 그 판정인지 근거를 댈 수 있어야 하기 때문입니다. 생성형 모델은 둘 다 보장하지 못합니다.

### 기준표와 출처

`src/lib/labs/data/` 에 두 개의 JSON이 있습니다.

| 파일 | 내용 |
|---|---|
| `reference_ranges.json` | 검사 항목 26개의 분기별 기준 범위, 교차 규칙 4개 |
| `sources.json` | 학회 원문 출처 29건 |

출처는 ACOG, WHO, 미국갑상선학회, 대한갑상선학회, 대한당뇨병학회, 미국당뇨병학회 등입니다. 판정 하나에는 반드시 출처가 붙고, 화면에서 "원문 확인"을 누르면 해당 가이드라인으로 이동합니다.

출처마다 신뢰 등급과 검증 상태를 함께 기록합니다.

```jsonc
"acog_pb233_2021": {
  "title": "ACOG Practice Bulletin No. 233: Anemia in Pregnancy",
  "citation_ko": "미국산부인과학회 진료지침 제233호 (2021)",
  "trust_tier": "A",
  "verification": "mirror_verified",
  "verified_at": "2026-08-19",
  "note": "acog.org 본사이트는 HTTP 402로 접근 차단. 2026년 현행 여부는 배포 전 1회 재확인 권장."
}
```

신뢰 등급 D인 출처는 판정에 쓰지 않습니다. 아직 원문을 확보하지 못한 항목은 `pendingVerification` 에 무엇이 남았는지 적어 둡니다. 근거가 확실하지 않은 채로 판정을 내리지 않기 위해서입니다.

### 판정 규칙

```jsonc
"range_priority": ["printed_lab_range", "trimester_reference_interval", "guideline_cutoff"],
"unknown_item_behavior": "return_unsupported",
"missing_unit_behavior": "return_needs_confirmation"
```

검사지에 인쇄된 참고치를 먼저 보되, 임신 특이 항목은 분기별 참고구간이 우선합니다. 앞서 든 혈색소 사례가 여기서 갈립니다.

모르는 항목은 정상이라고 추측하지 않고 `unsupported` 로 둡니다. 단위를 읽지 못했으면 `indeterminate` 로 두고 사용자에게 되묻습니다. 이상 수치를 정상이라고 말하면 병원에 가야 할 사람이 가지 않게 되지만, 정상을 확인 필요라고 하면 한 번 더 확인하게 될 뿐입니다. 두 실패의 무게가 다르므로 기울일 방향도 정해져 있습니다.

### 상태 7종을 4종으로

엔진은 세분화된 상태를 내고, 화면 칩은 네 가지만 씁니다.

| 엔진 | 세부 라벨 | 화면 칩 |
|---|---|---|
| `safe` | 안심 | 안심 |
| `watch` | 주의 | 주의 |
| `recheck` | 재검 필요 | 주의 |
| `alert` | 즉시 상담 | 위험 |
| `indeterminate` | 판정 보류 | 확인 필요 |
| `info_only` | 참고 | 확인 필요 |
| `unsupported` | 미지원 | 확인 필요 |

`bridge.ts` 가 이 변환을 맡습니다. 세부 라벨은 상세 화면에서만 보여줍니다. 회귀 테스트에서 세부 라벨과 화면 칩이 서로 모순되지 않는지 확인합니다.

<br/>

## 구조

Expo Router 기반이라 `src/app` 의 폴더 구조가 곧 화면 경로입니다.

```
src/
├── app/
│   ├── (auth)/               로그인 · 회원가입
│   ├── (tabs)/
│   │   ├── home              홈
│   │   ├── analysis/         분석 — 항목별 추이, 검사지 상세
│   │   ├── calendar/         캘린더 — 진료 일정, 질문
│   │   ├── record            기록 — 검사지 타임라인
│   │   └── settings          설정
│   └── (modals)/
│       ├── scan/             촬영 → 분석 → 날짜 확인 → 결과
│       ├── profile-edit      개인정보 수정
│       └── faq · terms
│
├── components/               status-badge · trend-chart · food-image · tab-bar
│
└── lib/
    ├── labs/                 판정 엔진 (기준표 · 정규화 · 판정 · 브리지)
    ├── api/                  백엔드 호출 (http · client · types · mock-data)
    ├── ocr.ts                검사지 사진을 구조화된 행으로
    ├── insights.ts           요약 · 추천 질문 · 식재료 생성
    ├── report.ts             화면이 쓰는 리포트 타입
    ├── pregnancy.ts          주수 계산
    └── foods.ts              추천 가능 식재료 화이트리스트
```

### 백엔드 연동

`src/lib/api/http.ts` 가 호출을 담당합니다. 응답 껍데기를 벗기고, 액세스 토큰이 만료되면 한 번 재발급한 뒤 같은 요청을 다시 보냅니다.

검사지는 앱이 OCR과 판정을 끝낸 뒤 `POST /reports` 로 결과만 보내고, 원본 사진은 `POST /test-sheets/{id}/images` 로 따로 붙입니다.

<br/>

## 실행

Node 20 이상과 Expo Go 또는 시뮬레이터가 필요합니다.

```bash
npm install
cp .env.example .env
npm start
```

`.env` 에는 백엔드 주소만 넣습니다.

```bash
EXPO_PUBLIC_API_BASE_URL=https://1.201.117.27.nip.io
```

이 값을 비우면 `src/lib/api/mock-data.ts` 의 목 데이터로 동작합니다. 백엔드 없이 화면만 확인할 때 씁니다.

OpenAI 키는 `.env` 에 두지 않습니다. `EXPO_PUBLIC_` 접두사는 클라이언트 번들에 포함된다는 뜻이라, 키를 넣으면 배포된 앱에서 누구나 꺼낼 수 있습니다. 키는 서버 환경변수에만 두고 앱은 서버 프록시를 거쳐 호출합니다.

### 판정 엔진 회귀 테스트

```bash
npx tsx src/lib/labs/evaluate.test.ts
```

실제 검사지에서 나온 사례를 케이스로 고정해 두었습니다. 기준표를 수정할 때마다 이것부터 실행합니다.

### 웹 배포

```bash
npm run deploy:preview   # 미리보기
npm run deploy           # 프로덕션
```
