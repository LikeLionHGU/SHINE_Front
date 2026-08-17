# API 레이어

화면은 서버를 직접 부르지 않고 **`@/lib/api` 한 곳**만 통해서 데이터를 읽고 씁니다.
그래서 백엔드가 준비되면 **`client.ts` 안의 함수 본문만** 바꾸면 화면 코드는 그대로 둬도 됩니다.

```
src/lib/api/
  index.ts      ← 화면은 항상 여기서 import
  types.ts      ← 화면이 쓰는 데이터 모양(요청/응답 타입)
  client.ts     ← 실제 데이터 접근 함수들 (지금은 목 데이터)
  http.ts       ← fetch 공통 처리 (baseURL, 토큰, 에러)
  mock-data.ts  ← 서버 붙이면 지워도 되는 더미 값
```

## 1. 백엔드 주소 넣기

프로젝트 루트 `.env` 에 추가하고 개발 서버를 재시작합니다.

```
EXPO_PUBLIC_API_BASE_URL=https://api.example.com
```

`EXPO_PUBLIC_` 접두사가 있어야 앱 번들에 값이 들어갑니다.

## 2. 함수 본문 바꾸기

`client.ts` 의 각 함수 위에는 어떤 엔드포인트로 가야 하는지 `TODO(api)` 주석이 달려 있습니다.

```ts
/** 그 날 진료에서 직접 물어보려고 적어둔 질문 */
export async function getVisitQuestions(date: VisitDate): Promise<string[]> {
  // TODO(api): GET /visits/:date/questions
  ...목 데이터...
}
```

이 본문을 `apiRequest` 호출로 교체하면 끝입니다.

```ts
export async function getVisitQuestions(date: VisitDate): Promise<string[]> {
  return apiRequest<string[]>(`/visits/${date}/questions`);
}
```

반환 타입(`Promise<string[]>`)만 유지하면 화면은 수정할 필요가 없습니다.
서버 응답 필드명이 다르면 여기서 `types.ts` 모양으로 변환해서 돌려주세요.

남은 `TODO(api)` 를 한 번에 보려면:

```bash
grep -rn "TODO(api)" src/lib/api/client.ts
```

## 3. 인증

- `login()` / `signup()` 이 성공하면 `setAuthToken(token)` 으로 토큰을 저장합니다.
- 이후 `apiRequest` 는 `skipAuth: true` 가 아닌 모든 요청에
  `Authorization: Bearer <token>` 헤더를 자동으로 붙입니다.
- `logout()` 은 토큰과 로컬 캐시를 지웁니다.

## 4. 에러 처리

실패하면 `ApiError` 가 던져집니다. 상태 코드로 분기할 수 있습니다.

```ts
try {
  await login({ accountId, password });
} catch (e) {
  if (e instanceof ApiError && e.status === 401) {
    setError("아이디 또는 비밀번호가 올바르지 않습니다.");
  }
}
```

`EXPO_PUBLIC_API_BASE_URL` 이 비어 있으면 `status: 0` 인 `ApiError` 가 납니다.

## 5. 로컬 저장 키

서버 연결 전까지 목 데이터는 AsyncStorage 에 저장됩니다.
데이터 구조를 바꿨을 때는 키 끝의 버전(`.v1`)을 올려주세요.

| 키 | 내용 |
| --- | --- |
| `shine.auth.token` | 로그인 토큰 |
| `shine.pregnancy.v1` | 임신 주차 / 기준 시점 |
| `shine.calendar.visits.v1` | 캘린더 일정 |
| `shine.calendar.questions.v1` | 진료 때 물어볼 질문 |
