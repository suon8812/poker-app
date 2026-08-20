import { GameState, Player } from '../poker/types';
import { reconnectPlayer, markPlayerDisconnected } from '../poker/gameEngine';

const MAX_SEATS = 9;
const STARTING_CHIPS = 1000;

export function createInitialGameState(params: {
  roomId: string;
  roomName: string;
  hostId: string;
  smallBlind: number;
  bigBlind: number;
  activeModifiers: string[];
}): GameState {
  const now = Date.now();
  return {
    roomId: params.roomId,
    roomName: params.roomName,
    hostId: params.hostId,
    players: [],
    communityCards: [],
    deck: [],
    pots: [],
    phase: 'waiting',
    dealerIndex: -1,
    turnIndex: 0,
    currentMaxBet: 0,
    minRaise: params.bigBlind,
    smallBlind: params.smallBlind,
    bigBlind: params.bigBlind,
    actionLog: [],
    handNumber: 0,
    activeModifiers: params.activeModifiers,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 방 참가 처리.
 * - 이미 참가했던 플레이어(userId 일치)라면 재접속으로 처리 (자리, 칩 유지)
 * - 신규 플레이어라면 빈 좌석에 배정하고 기본 칩 지급
 * - 게임이 이미 진행 중이면 신규 플레이어는 다음 핸드부터 참여 (sittingOut 유지, phase는 안 건드림)
 */
export function joinRoom(state: GameState, userId: string, nickname: string): GameState {
  const existing = state.players.find(p => p.id === userId);
  if (existing) {
    return reconnectPlayer(state, userId);
  }

  if (state.players.length >= MAX_SEATS) {
    throw new Error('ROOM_FULL');
  }

  const usedSeats = new Set(state.players.map(p => p.seatIndex));
  let seatIndex = 0;
  while (usedSeats.has(seatIndex)) seatIndex++;

  const newPlayer: Player = {
    id: userId,
    nickname,
    chips: STARTING_CHIPS,
    holeCards: [],
    status: state.phase === 'waiting' ? 'active' : 'sittingOut',
    currentBet: 0,
    totalBetInHand: 0,
    isDealer: false,
    seatIndex,
    lastSeenAt: Date.now(),
    connected: true,
    augments: [],
  };

  return {
    ...state,
    players: [...state.players, newPlayer],
    hostId: state.hostId || userId,
    updatedAt: Date.now(),
  };
}

/**
 * 방 퇴장 처리.
 * - 진행 중인 핸드가 있으면 즉시 제거하지 않고 폴드 + disconnected 처리하여
 *   사이드팟/턴 로직이 깨지지 않도록 함.
 * - 대기 상태(waiting)라면 즉시 목록에서 제거.
 */
export function leaveRoom(state: GameState, userId: string): GameState {
  const player = state.players.find(p => p.id === userId);
  if (!player) return state;

  if (state.phase === 'waiting' || state.phase === 'handOver') {
    return {
      ...state,
      players: state.players.filter(p => p.id !== userId),
      hostId: state.hostId === userId ? state.players.find(p => p.id !== userId)?.id ?? '' : state.hostId,
      updatedAt: Date.now(),
    };
  }

  // 핸드 진행 중 퇴장 -> 폴드 처리 후 연결 끊김 표시 (다음 핸드에서 완전히 제거)
  let newState: GameState = {
    ...state,
    players: state.players.map(p => (p.id === userId ? { ...p, status: 'folded' as const } : p)),
  };
  newState = markPlayerDisconnected(newState, userId);
  return newState;
}

/** 다음 핸드 시작 전, 연결이 오래 끊긴 채 칩도 없는 플레이어를 완전히 제거 */
export function pruneStalePlayers(state: GameState, staleMs = 5 * 60 * 1000): GameState {
  const now = Date.now();
  return {
    ...state,
    players: state.players.filter(p => p.connected || now - p.lastSeenAt < staleMs),
    updatedAt: now,
  };
}

export function isRoomEmpty(state: GameState): boolean {
  return state.players.length === 0;
}
