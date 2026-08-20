import { GameState, Player, ActionType, RoundPhase, PotInfo, WinnerResult } from './types';
import { createShuffledDeck } from './deck';
import { evaluateHand, compareHands } from './handEvaluator';
import { getActiveModifiers } from './modifiers/registry';

const TURN_TIME_LIMIT_MS = 30_000;

// ============================================================
// 새 핸드 시작
// ============================================================
export function startNewHand(state: GameState): GameState {
  const modifiers = getActiveModifiers(state.activeModifiers);
  let deck = createShuffledDeck();

  for (const mod of modifiers) {
    if (mod.onDeckCreate) deck = mod.onDeckCreate(deck);
  }

  // 칩이 0이거나 연결이 끊긴 채 오래된 플레이어는 이번 핸드에서 제외
  let players: Player[] = state.players.map(p => ({
    ...p,
    holeCards: [],
    status: p.chips > 0 && p.connected ? ('active' as const) : ('sittingOut' as const),
    currentBet: 0,
    totalBetInHand: 0,
    isDealer: false,
  }));

  const activeIdxs = players.map((p, i) => i).filter(i => players[i].status === 'active');
  if (activeIdxs.length < 2) {
    return { ...state, players, phase: 'waiting', updatedAt: Date.now() };
  }

  const dealerIndex = nextActiveSeat(players, state.dealerIndex);
  players[dealerIndex].isDealer = true;

  const sbIndex = nextActiveSeat(players, dealerIndex);
  const bbIndex = nextActiveSeat(players, sbIndex);

  players = postBlind(players, sbIndex, state.smallBlind);
  players = postBlind(players, bbIndex, state.bigBlind);

  const activePlayers = players.filter(p => p.status === 'active' || p.status === 'allin');
  activePlayers.forEach(p => {
    p.holeCards = [deck.pop()!, deck.pop()!];
  });

  const pot: PotInfo = {
    amount: players[sbIndex].currentBet + players[bbIndex].currentBet,
    eligiblePlayerIds: activePlayers.map(p => p.id),
    isMain: true,
  };

  let newState: GameState = {
    ...state,
    deck,
    players,
    communityCards: [],
    pots: [pot],
    phase: 'preflop',
    dealerIndex,
    turnIndex: nextActiveSeat(players, bbIndex),
    currentMaxBet: state.bigBlind,
    minRaise: state.bigBlind,
    actionLog: [
      { playerId: players[sbIndex].id, nickname: players[sbIndex].nickname, action: 'post-blind', amount: state.smallBlind, timestamp: Date.now(), phase: 'preflop' },
      { playerId: players[bbIndex].id, nickname: players[bbIndex].nickname, action: 'post-blind', amount: state.bigBlind, timestamp: Date.now(), phase: 'preflop' },
    ],
    handNumber: state.handNumber + 1,
    winners: undefined,
    turnDeadline: Date.now() + TURN_TIME_LIMIT_MS,
    updatedAt: Date.now(),
  };

  for (const mod of modifiers) {
    if (mod.onHandStart) newState = mod.onHandStart(newState);
  }

  return newState;
}

function postBlind(players: Player[], idx: number, amount: number): Player[] {
  const copy = [...players];
  const p = { ...copy[idx] };
  const postAmount = Math.min(amount, p.chips);
  p.chips -= postAmount;
  p.currentBet = postAmount;
  p.totalBetInHand = postAmount;
  if (p.chips === 0) p.status = 'allin';
  copy[idx] = p;
  return copy;
}

// ============================================================
// 플레이어 액션 처리
// ============================================================
export function applyAction(state: GameState, playerId: string, action: ActionType, amount?: number): GameState {
  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return state;
  if (state.turnIndex !== playerIdx) return state; // 내 턴이 아니면 무시
  if (state.players[playerIdx].status !== 'active') return state;

  let players = [...state.players];
  let player = { ...players[playerIdx] };
  let currentMaxBet = state.currentMaxBet;
  let minRaise = state.minRaise;
  let loggedAction: ActionType = action;
  let loggedAmount: number | undefined = amount;

  switch (action) {
    case 'fold': {
      player.status = 'folded';
      break;
    }
    case 'check': {
      if (player.currentBet < currentMaxBet) return state; // 유효하지 않음
      break;
    }
    case 'call': {
      const callAmount = Math.min(currentMaxBet - player.currentBet, player.chips);
      player.chips -= callAmount;
      player.currentBet += callAmount;
      player.totalBetInHand += callAmount;
      loggedAmount = player.currentBet;
      if (player.chips === 0) {
        player.status = 'allin';
        loggedAction = 'allin';
      }
      break;
    }
    case 'raise': {
      if (amount === undefined) return state;
      const targetBet = amount; // 절대 베팅 총액 기준
      if (targetBet <= currentMaxBet) return state;
      const raiseIncrement = targetBet - currentMaxBet;
      if (raiseIncrement < minRaise && targetBet < player.chips + player.currentBet) {
        return state; // 최소 레이즈 미달 (올인이 아닌 경우)
      }
      const chipsNeeded = Math.min(targetBet - player.currentBet, player.chips);
      player.chips -= chipsNeeded;
      player.currentBet += chipsNeeded;
      player.totalBetInHand += chipsNeeded;
      minRaise = Math.max(minRaise, player.currentBet - currentMaxBet);
      currentMaxBet = player.currentBet;
      loggedAmount = player.currentBet;
      if (player.chips === 0) {
        player.status = 'allin';
        loggedAction = 'allin';
      }
      break;
    }
    default:
      return state;
  }

  players[playerIdx] = player;

  const newLog = [
    ...state.actionLog,
    { playerId, nickname: player.nickname, action: loggedAction, amount: loggedAmount, timestamp: Date.now(), phase: state.phase },
  ];

  let newState: GameState = {
    ...state,
    players,
    currentMaxBet,
    minRaise,
    actionLog: newLog,
    pots: calculateSidePots(players, state.pots),
    updatedAt: Date.now(),
  };

  const modifiers = getActiveModifiers(state.activeModifiers);
  for (const mod of modifiers) {
    if (mod.onPlayerAction) newState = mod.onPlayerAction(newState, playerId, loggedAction);
  }

  const remainingActive = newState.players.filter(p => p.status === 'active' || p.status === 'allin');
  const stillContesting = newState.players.filter(p => p.status !== 'folded');

  if (stillContesting.length === 1) {
    // 전원 폴드 - 즉시 종료, 남은 1명이 팟 전체 획득
    return awardUncontested(newState);
  }

  if (isBettingRoundComplete(newState)) {
    return advancePhase(newState);
  }

  newState.turnIndex = nextActingSeat(newState.players, playerIdx);
  newState.turnDeadline = Date.now() + TURN_TIME_LIMIT_MS;
  return newState;
}

/** 전원 폴드로 인해 쇼다운 없이 팟을 가져가는 경우 */
function awardUncontested(state: GameState): GameState {
  const winner = state.players.find(p => p.status !== 'folded')!;
  const potTotal = state.pots.reduce((sum, p) => sum + p.amount, 0);

  const players = state.players.map(p => (p.id === winner.id ? { ...p, chips: p.chips + potTotal } : p));

  let newState: GameState = {
    ...state,
    players,
    phase: 'handOver',
    winners: [
      {
        playerId: winner.id,
        nickname: winner.nickname,
        handRank: '-',
        handDescription: '상대 전원 폴드로 승리',
        potWon: potTotal,
        potIndex: 0,
      },
    ],
    updatedAt: Date.now(),
  };

  const modifiers = getActiveModifiers(state.activeModifiers);
  for (const mod of modifiers) {
    if (mod.onHandEnd) newState = mod.onHandEnd(newState, [winner.id]);
  }

  return newState;
}

// ============================================================
// 라운드/페이즈 진행
// ============================================================
function advancePhase(state: GameState): GameState {
  const modifiers = getActiveModifiers(state.activeModifiers);

  let preState = state;
  for (const mod of modifiers) {
    if (mod.onBettingRoundEnd) preState = mod.onBettingRoundEnd(preState);
  }

  const deck = [...preState.deck];
  const players = preState.players.map(p => ({ ...p, currentBet: 0 }));

  const phaseOrder: RoundPhase[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const currentPhaseIdx = phaseOrder.indexOf(preState.phase);
  const nextPhase = phaseOrder[currentPhaseIdx + 1] ?? 'showdown';

  let communityCards = [...preState.communityCards];
  if (nextPhase === 'flop') communityCards.push(deck.pop()!, deck.pop()!, deck.pop()!);
  else if (nextPhase === 'turn' || nextPhase === 'river') communityCards.push(deck.pop()!);

  // 활성 플레이어(폴드 안 한 사람)가 모두 올인 상태거나 1명만 베팅 가능하면
  // 베팅 없이 바로 다음 카드를 연속 오픈 (런아웃)
  const canStillBet = players.filter(p => p.status === 'active').length > 1;

  let newState: GameState = {
    ...preState,
    deck,
    players,
    communityCards,
    phase: nextPhase,
    currentMaxBet: 0,
    minRaise: preState.bigBlind,
    turnIndex: nextActiveSeat(players, preState.dealerIndex),
    turnDeadline: Date.now() + TURN_TIME_LIMIT_MS,
    updatedAt: Date.now(),
  };

  if (nextPhase === 'showdown') {
    return resolveShowdown(newState);
  }

  if (!canStillBet) {
    // 모두 올인 -> 베팅 스킵하고 자동으로 다음 페이즈 진행 (런아웃)
    return advancePhase(newState);
  }

  return newState;
}

// ============================================================
// 사이드팟 계산 (사이드팟 정밀 로직)
// ============================================================
export function calculateSidePots(players: Player[], _prevPots: PotInfo[]): PotInfo[] {
  const contributors = players.filter(p => p.totalBetInHand > 0);
  if (contributors.length === 0) return [];

  // 올인/폴드 여부와 무관하게, 베팅 총액 기준으로 레이어를 나눔
  const uniqueLevels = [...new Set(contributors.map(p => p.totalBetInHand))].sort((a, b) => a - b);

  const pots: PotInfo[] = [];
  let prevLevel = 0;

  uniqueLevels.forEach((level, idx) => {
    const layerSize = level - prevLevel;
    if (layerSize <= 0) {
      prevLevel = level;
      return;
    }
    // 이 레이어에 기여한 사람 = totalBetInHand가 이 레벨 이상인 사람
    const contributorsAtLayer = contributors.filter(p => p.totalBetInHand >= level);
    const amount = layerSize * contributorsAtLayer.length;

    // 이 팟을 가져갈 자격 = 기여했고 + 폴드하지 않은 사람
    const eligiblePlayerIds = contributorsAtLayer.filter(p => p.status !== 'folded').map(p => p.id);

    pots.push({
      amount,
      eligiblePlayerIds,
      isMain: idx === 0,
    });
    prevLevel = level;
  });

  return pots.length > 0 ? pots : [{ amount: 0, eligiblePlayerIds: [], isMain: true }];
}

// ============================================================
// 쇼다운 처리 (멀티 팟 분배 지원)
// ============================================================
function resolveShowdown(state: GameState): GameState {
  const contenders = state.players.filter(p => p.status !== 'folded');
  const evaluations = new Map(
    contenders.map(p => [p.id, evaluateHand([...p.holeCards, ...state.communityCards])])
  );

  let players = [...state.players];
  const winners: WinnerResult[] = [];

  state.pots.forEach((pot, potIndex) => {
    if (pot.amount <= 0 || pot.eligiblePlayerIds.length === 0) return;

    const eligibleEvals = pot.eligiblePlayerIds
      .map(id => ({ id, evaluation: evaluations.get(id)! }))
      .filter(e => e.evaluation);

    if (eligibleEvals.length === 0) return;

    eligibleEvals.sort((a, b) => compareHands(b.evaluation, a.evaluation));
    const bestScore = eligibleEvals[0].evaluation.score;
    const potWinners = eligibleEvals.filter(e => e.evaluation.score === bestScore);
    const share = Math.floor(pot.amount / potWinners.length);
    const remainder = pot.amount - share * potWinners.length;

    potWinners.forEach((w, i) => {
      const bonus = i === 0 ? remainder : 0; // 나머지 칩은 첫 번째 승자(딜러 기준 우선순위)에게
      players = players.map(p => (p.id === w.id ? { ...p, chips: p.chips + share + bonus } : p));
      const player = players.find(p => p.id === w.id)!;
      winners.push({
        playerId: w.id,
        nickname: player.nickname,
        handRank: w.evaluation.rankName,
        handDescription: w.evaluation.description,
        potWon: share + bonus,
        potIndex,
      });
    });
  });

  let newState: GameState = {
    ...state,
    players,
    phase: 'handOver',
    winners,
    updatedAt: Date.now(),
  };

  const modifiers = getActiveModifiers(state.activeModifiers);
  for (const mod of modifiers) {
    if (mod.onHandEnd) newState = mod.onHandEnd(newState, winners.map(w => w.playerId));
  }

  return newState;
}

// ============================================================
// 좌석 순회 헬퍼
// ============================================================
/** status와 무관하게 다음 좌석(딜러 버튼 이동용) */
function nextActiveSeat(players: Player[], fromIndex: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (players[idx].status !== 'sittingOut') return idx;
  }
  return fromIndex;
}

/** 다음으로 액션할 수 있는(status === 'active') 좌석. 없으면 현재 인덱스 유지 */
function nextActingSeat(players: Player[], fromIndex: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (players[idx].status === 'active') return idx;
  }
  return fromIndex;
}

function isBettingRoundComplete(state: GameState): boolean {
  const active = state.players.filter(p => p.status === 'active');
  if (active.length === 0) return true;
  if (active.length === 1) {
    // 나머지 전부 올인/폴드 상태면 이 1명이 콜/체크 완료 시 라운드 종료
    return active.every(p => p.currentBet === state.currentMaxBet);
  }
  return active.every(p => p.currentBet === state.currentMaxBet);
}

// ============================================================
// 재접속 / 타임아웃 처리
// ============================================================

/** 플레이어를 연결 끊김 상태로 표시 (게임 중이면 sittingOut 대신 disconnected 유지) */
export function markPlayerDisconnected(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === playerId ? { ...p, connected: false, lastSeenAt: Date.now() } : p)),
    updatedAt: Date.now(),
  };
}

/** 재접속 시 연결 상태 복구. 진행 중인 핸드가 있다면 다음 핸드부터 다시 참여 */
export function reconnectPlayer(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === playerId ? { ...p, connected: true, lastSeenAt: Date.now() } : p)),
    updatedAt: Date.now(),
  };
}

/**
 * 현재 턴인 플레이어가 turnDeadline을 초과했는지 확인하고,
 * 초과했다면 자동으로 폴드(또는 체크 가능하면 체크) 처리합니다.
 * 클라이언트가 폴링 중 데드라인 초과를 감지하면 이 함수를 호출하는 API를 때립니다.
 */
export function handleTurnTimeout(state: GameState): GameState {
  if (!state.turnDeadline || Date.now() < state.turnDeadline) return state;
  if (state.phase === 'waiting' || state.phase === 'handOver' || state.phase === 'showdown') return state;

  const player = state.players[state.turnIndex];
  if (!player || player.status !== 'active') return state;

  // 연결이 끊긴 플레이어는 이번 기회에 자동 폴드 처리
  const canCheck = player.currentBet >= state.currentMaxBet;
  return applyAction(state, player.id, canCheck ? 'check' : 'fold');
}
