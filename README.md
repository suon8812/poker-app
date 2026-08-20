# 🃏 Poker Night

친구들과 닉네임만으로 바로 즐기는 웹 기반 멀티플레이어 텍사스 홀덤. Next.js + Vercel Serverless + Pusher 기반으로 별도 백엔드 서버 없이 동작합니다.

## 1. 설치

```bash
npm install
```

## 2. 환경 변수 설정

`.env.local.example`을 복사해 `.env.local`을 만들고 값을 채워주세요.

```bash
cp .env.local.example .env.local
```

- **Pusher**: https://dashboard.pusher.com 에서 새 앱 생성 후 Channels 키 발급 (Cluster는 서울과 가까운 `ap3` 권장)
- **Vercel KV**: Vercel 대시보드 → Storage → Create Database → KV 생성. 로컬 개발 시 아래 명령으로 값을 가져올 수 있습니다.

```bash
vercel link
vercel env pull .env.local
```

## 3. 로컬 실행

```bash
npm run dev
```

http://localhost:3000 에서 확인 (Vercel KV는 클라우드 리소스이므로 로컬에서도 실제 KV에 연결됩니다).

## 4. Vercel 배포

```bash
vercel --prod
```

배포 후 Vercel 대시보드에서 환경 변수(Pusher 4종 + KV 4종)가 등록되어 있는지 확인하세요.

## 5. 프로젝트 구조

```
app/
  page.tsx                     닉네임 입장 게이트
  lobby/page.tsx                실시간 방 목록 로비
  room/[roomId]/page.tsx        게임방 (핵심 UI)
  api/
    rooms/route.ts                방 목록 조회 (GET) / 생성 (POST)
    rooms/[roomId]/route.ts       방 상태 단건 조회
    rooms/[roomId]/join/          입장 + 재접속 처리
    rooms/[roomId]/leave/         퇴장 처리 (핸드 중이면 폴드 후 disconnected)
    rooms/[roomId]/action/        체크/콜/레이즈/폴드
    rooms/[roomId]/start/         새 핸드 시작 (방장)
    rooms/[roomId]/timeout/       턴 타임아웃 강제 정리
    rooms/[roomId]/disconnect/    presence 기반 연결 끊김 알림
    pusher/auth/                  Presence 채널 인증
lib/
  poker/
    types.ts                     핵심 게임 상태 타입
    deck.ts                      덱 생성/셔플
    handEvaluator.ts              족보 판정 (7장 중 최적 5장)
    gameEngine.ts                  베팅/라운드 진행/사이드팟/쇼다운/재접속 로직
    modifiers/
      types.ts                    GameModifier 인터페이스 (확장 지점)
      registry.ts                  모디파이어 등록소 — 새 규칙은 여기 한 줄만 추가
      examples/                    와일드카드, 칩 보너스 등 예시 구현
  kv.ts                            Vercel KV read/write 헬퍼
  pusher.ts                        Pusher 서버/클라이언트 설정
  identity.ts                      쿠키 기반 사용자 식별
  store/
    roomStore.ts                   방 생성/입장/퇴장 비즈니스 로직
    uiStore.ts                     Zustand 기반 토스트 알림 스토어
components/                       UI 컴포넌트 (테이블, 카드, 베팅 컨트롤 등)
```

## 6. 특수 규칙 / 증강(Augment) 추가하는 법

게임 엔진(`gameEngine.ts`)은 정해진 시점마다 활성화된 모디파이어를 순서대로 호출합니다.
새 규칙을 추가해도 **게임 엔진 코드는 절대 수정할 필요가 없습니다.**

1. `lib/poker/modifiers/examples/`에 새 파일을 만들고 `GameModifier` 인터페이스를 구현합니다.

```typescript
// lib/poker/modifiers/examples/myNewRule.ts
import { GameModifier } from '../types';

export const myNewRule: GameModifier = {
  id: 'my-new-rule',
  name: '내 새 규칙',
  description: '설명',
  type: 'rule', // 또는 'augment'

  onHandStart(state) {
    // 매 핸드 시작 시 개입
    return state;
  },
};
```

2. `lib/poker/modifiers/registry.ts`에 한 줄 등록합니다.

```typescript
import { myNewRule } from './examples/myNewRule';

const MODIFIER_REGISTRY: Record<string, GameModifier> = {
  // ...기존 항목
  [myNewRule.id]: myNewRule,
};
```

3. 방 생성 API 호출 시 `activeModifiers` 배열에 id를 포함하면 해당 방에서 즉시 적용됩니다.

사용 가능한 훅: `onDeckCreate`, `onHandEvaluate`, `onPlayerAction`, `onBettingRoundEnd`, `onHandEnd`, `onHandStart`.

## 7. 구현된 핵심 기능

- 닉네임만으로 즉시 입장 (회원가입 없음, 쿠키 기반 세션)
- 로비 실시간 방 목록 (Pusher presence 채널)
- 클래식 텍사스 홀덤: 블라인드, 프리플랍/플랍/턴/리버, 체크/콜/레이즈/폴드, 쇼다운
- **사이드팟 완전 지원**: 여러 명이 다른 금액으로 올인해도 베팅 레벨별로 팟을 정확히 분리해 자격이 있는 플레이어끼리만 분배
- **재접속 처리**: 동일 브라우저(쿠키)로 재입장 시 자리와 칩 유지. Pusher presence의 `member_removed` 이벤트로 연결 끊김을 감지해 UI에 표시
- **턴 타임아웃**: 서버리스 환경 특성상 백그라운드 타이머가 없으므로, 클라이언트가 데드라인 초과를 감지하면 `/timeout` API를 호출해 자동으로 체크/폴드 처리 (idempotent)
- 초보자용 족보 힌트, 베팅 로그, 라운드 진행 상태 텍스트 표시
- 모바일/PC 반응형 레이아웃
- 와일드카드 규칙, 칩 보너스 증강 등 확장 예시 포함

## 8. 알려진 제한 사항 (추가 개선 여지)

- KV read-modify-write는 낙관적 잠금이 없어, 동시에 여러 명이 정확히 같은 타이밍에 액션을 보내면 경합이 생길 수 있습니다. 소규모 친목 게임에서는 문제 없지만, 트래픽이 커지면 버전 필드 비교(CAS) 방식으로 교체를 권장합니다.
- 턴 타임아웃은 클라이언트 폴링에 의존하므로, 방에 아무도 접속해 있지 않은 순간에는 즉시 처리되지 않고 다음 접속자가 들어올 때 정리됩니다.
