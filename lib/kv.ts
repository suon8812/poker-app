import { kv } from '@vercel/kv';
import { GameState } from './poker/types';

const ROOM_TTL_SECONDS = 60 * 60 * 6; // 6시간 후 자동 만료 (방치된 방 정리)
const ROOM_LIST_KEY = 'room:list';

export async function getRoom(roomId: string): Promise<GameState | null> {
  const room = await kv.get<GameState>(`room:${roomId}`);
  return room ?? null;
}

export async function saveRoom(roomId: string, state: GameState): Promise<void> {
  await kv.set(`room:${roomId}`, state, { ex: ROOM_TTL_SECONDS });
}

export async function listRoomIds(): Promise<string[]> {
  const ids = await kv.smembers(ROOM_LIST_KEY);
  return (ids ?? []) as string[];
}

export async function registerRoom(roomId: string): Promise<void> {
  await kv.sadd(ROOM_LIST_KEY, roomId);
}

export async function removeRoom(roomId: string): Promise<void> {
  await kv.del(`room:${roomId}`);
  await kv.srem(ROOM_LIST_KEY, roomId);
}

/**
 * 낙관적 잠금 없이 간단히 read-modify-write 하는 헬퍼.
 * 소규모 친목 포커(동시 요청 거의 없음) 기준으로는 충분하지만,
 * 트래픽이 커지면 KV의 WATCH/MULTI 또는 버전 필드 비교로 교체 권장.
 */
export async function updateRoom(
  roomId: string,
  updater: (state: GameState) => GameState
): Promise<GameState | null> {
  const current = await getRoom(roomId);
  if (!current) return null;
  const updated = updater(current);
  await saveRoom(roomId, updated);
  return updated;
}
