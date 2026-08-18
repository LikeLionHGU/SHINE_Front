# API 레이어

화면은 서버를 직접 부르지 않고 **`@/lib/api` 한 곳**만 통해서 데이터를 읽고 씁니다.

```
src/lib/api/
  index.ts      ← 화면은 항상 여기서 import
  types.ts      ← 화면이 쓰는 데이터 모양(요청/응답 타입)
  client.ts     ← 실제 데이터 접근 함수들 (백엔드 연결됨)
  http.ts       ← fetch 공통 처리 (baseURL, 토큰, 응답 껍데기, 에러)
  mock-data.ts  ← 서버가 안 뜰 때 되돌아가는 폴백 값
```

## 1. 백엔드 주소

프로젝트 루트 `.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://1.201.117.27:8080
```

`EXPO_PUBLIC_` 접두사가 있어야 앱 번들에 값이 들어갑니다.
값을 바꿨으면 캐시를 비우고 개발 서버를 재시작하세요 — `npx expo start -c`.

현재는 배포된 서버 주소라 어느 망에서나 접근됩니다.
Swagger: http://1.201.117.27:8080/swagger-ui/index.html
비워두면 모든 함수가 목 데이터로 동작합니다.

## 2. 엔드포인트

`apiRequest`가 `/api/v1`을 자동으로 붙이므로 그 뒤 경로만 넘깁니다.

| client.ts 함수 | 엔드포인트 |
| --- | --- |
| `login()` | `POST /auth/login` |
| `signup()` | `POST /auth/signup` → 이어서 `POST /auth/login` |
| `logout()` | `POST /auth/logout` |
| `getUserProfile()` | `GET /app/me` |
| `getPregnancyInfo()` | `GET /users/me` |
| `savePregnancyInfo(week)` | `PATCH /users/me/pregnancy` |
| `getVisits()` | `GET /app/visits` |
| `saveVisit(visit)` | `POST /app/visits` |
| `deleteVisit(id)` | `DELETE /app/visits/{id}` |
| `getCalendarMonthMarks(y, m)` | `GET /app/calendar/marks?year=&month=` |
| `getVisitDetail(date)` | `GET /app/visits/{date}/detail` |
| `getRecords()` | `GET /app/records` |
| `getTrends()` | `GET /app/trends` |
| `getTrend(id)` | `GET /app/trends/{id}` |
| `submitReport(...)` | `POST /reports` |

`getCalendarMonthMarks`의 `month`는 `Date.getMonth()` 값(0~11)을 그대로 받고,
서버로 보낼 때 1~12로 바꿔줍니다.

## 3. 응답 껍데기

서버는 성공·실패 모두 같은 모양으로 돌려줍니다.

```json
{ "success": true, "code": "SUCCESS", "message": "...", "data": { } }
```

`apiRequest`가 껍데기를 벗기고 `data`만 돌려주므로, 호출부는 `data` 안쪽 타입만
신경 쓰면 됩니다. HTTP는 200인데 `success: false`인 경우도 실패로 처리합니다.

## 4. 인증

- `login()` / `signup()` 이 성공하면 accessToken(+ 자동 로그인 시 refreshToken)을 저장합니다.
- 이후 `apiRequest` 는 `skipAuth: true` 가 아닌 모든 요청에
  `Authorization: Bearer <token>` 헤더를 자동으로 붙입니다.
- accessToken이 만료돼 401이 오면 `POST /auth/reissue` 로 **한 번 자동 재발급**하고
  같은 요청을 다시 보냅니다. 재발급도 실패하면 토큰을 비웁니다.
- refreshToken은 Rotation이라 재발급할 때마다 새 값으로 덮어씁니다.

## 5. 실패 처리 — 목 폴백

조회·저장 함수는 `withFallback`으로 감싸져 있어서, 서버가 안 떠 있거나 요청이
실패하면 예전 목 데이터/AsyncStorage로 되돌아갑니다. **화면은 절대 비지 않지만
연동 버그가 숨을 수 있으니**, 데이터가 이상하면 콘솔의 `[api] ... 실패` 경고를
먼저 확인하세요.

폴백하지 않고 그대로 오류를 던지는 함수는 셋뿐입니다 — `login()`, `signup()`,
`submitReport()`. 사용자가 실패를 알아야 하는 동작이라서입니다.

```ts
try {
  await login({ accountId, password, autoLogin });
} catch (e) {
  if (e instanceof ApiError && e.code === "ACCOUNT_LOCKED") { ... }
  setError(e instanceof Error ? e.message : "로그인에 실패했어요.");
}
```

`ApiError`에는 `status`(HTTP)와 `code`(서버 에러 코드, 예: `LOGIN_FAILED`)가 함께 담깁니다.
검증 실패(`INVALID_INPUT`)면 `data.errors[0].reason`이 `message`로 올라옵니다.

## 6. 검사지 업로드 흐름

OCR과 AI 요약은 프론트가 담당합니다 (`lib/ocr.ts`, `lib/insights.ts`).

```
scan/date-confirm.tsx   parseTestReport(사진) → 검사항목 + 검사일
scan/analyzing.tsx      generateReportInsights(항목) → 요약·질문·음식
                        submitReport(전부)  → POST /api/v1/reports
                        ↳ 서버 교정본을 saveLastReport로 저장
```

서버는 받은 결과를 **임신 기준으로 다시 판정**해서 돌려줍니다. 검사지에 인쇄된
참고치는 비임신 기준인 경우가 많아(혈색소 11.5 → 검사지 기준 "주의", 임신 기준
"안심"), 화면에는 서버 판정을 보여줘야 맞습니다. 항목명도 카탈로그 대표명
("헤모글로빈" → "혈색소")으로 통일돼 돌아옵니다.

전송이 실패하면 프론트 OCR 결과 그대로 저장해 화면은 살려둡니다.

## 7. 로컬 저장 키

| 키 | 내용 |
| --- | --- |
| `shine.auth.token` | accessToken |
| `shine.auth.refreshToken` | refreshToken (자동 로그인) |
| `shine.pregnancy.v1` | 임신 주차 / 기준 시점 (서버 값 캐시) |
| `shine.calendar.visits.v1` | 캘린더 일정 (폴백용) |
| `shine.calendar.questions.v1` | 진료 때 물어볼 질문 (폴백용) |
