// ============================================================
// 핵심 게임 상태 타입 정의
// 이 파일은 게임 엔진, 모디파이어 시스템, UI 컴포넌트 전체가 공유합니다.
// ============================================================

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  // 향후 특수 카드(와일드 등)를 위한 확장 필드
  isWild?: boolean;
  meta?: Record<string, unknown>;
}

export type PlayerStatus = 'active' | 'folded' | 'allin' | 'sittingOut' | 'disconnected';

export interface Player {
  id: string; // userId 쿠키 기반, 세션 고정 식별자
  nickname: string;
  chips: number;
  holeCards: Card[];
  status: PlayerStatus;
  currentBet: number; // 이번 베팅 라운드에 낸 금액
  totalBetInHand: number; // 이번 핸드 전체에 낸 금액 (사이드팟 계산용)
  isDealer: boolean;
  seatIndex: number;
  // 재접속 처리를 위한 필드
  lastSeenAt: number;
  connected: boolean;
  // 증강/패시브 슬롯 - 향후 확장 지점
  augments: AppliedAugment[];
}

export type RoundPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'handOver';

export type ActionType = 'check' | 'call' | 'raise' | 'fold' | 'allin' | 'post-blind';

export interface ActionLogEntry {
  playerId: string;
  nickname: string;
  action: ActionType;
  amount?: number;
  timestamp: number;
  phase: RoundPhase;
}

export interface PotInfo {
  amount: number;
  eligiblePlayerIds: string[]; // 이 팟을 가져갈 수 있는 플레이어 (사이드팟 지원)
  isMain: boolean;
}

export interface GameState {
  roomId: string;
  roomName: string;
  hostId: string; // 방장 (방 삭제/설정 권한)
  players: Player[];
  communityCards: Card[];
  deck: Card[];
  pots: PotInfo[];
  phase: RoundPhase;
  dealerIndex: number;
  turnIndex: number;
  currentMaxBet: number;
  minRaise: number; // 최소 레이즈 단위 (No-Limit 룰: 마지막 레이즈 폭 이상)
  smallBlind: number;
  bigBlind: number;
  actionLog: ActionLogEntry[];
  handNumber: number;
  // 활성화된 특수 규칙/증강 목록 - 확장성의 핵심
  activeModifiers: string[];
  winners?: WinnerResult[];
  turnDeadline?: number; // 재접속/타임아웃 처리용 타임스탬프 (ms)
  createdAt: number;
  updatedAt: number;
}

export interface WinnerResult {
  playerId: string;
  nickname: string;
  handRank: string;
  handDescription: string;
  potWon: number;
  potIndex: number;
}

// ===== 증강/특수규칙 확장 인터페이스 =====
export interface AppliedAugment {
  id: string;
  appliedAtHand: number;
  data?: Record<string, unknown>;
}

export interface HandEvaluation {
  rankName: string;
  rankTier: number; // 0(하이카드) ~ 8(스트레이트 플러시)
  score: number; // 비교용 정수 점수 (높을수록 강함)
  description: string;
  bestFive: Card[];
}
