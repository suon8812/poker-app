import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getRoom, saveRoom, listRoomIds, registerRoom } from '@/lib/kv';
import { getPusherServer, CHANNELS, EVENTS } from '@/lib/pusher';
import { createInitialGameState } from '@/lib/store/roomStore';
import { getIdentity } from '@/lib/identity';
import { GameState } from '@/lib/poker/types';

export async function GET() {
  const roomIds = await listRoomIds();
  const rooms = await Promise.all(
    roomIds.map(async id => {
      const state = await getRoom(id);
      if (!state) return null;
      return {
        roomId: state.roomId,
        roomName: state.roomName,
        playerCount: state.players.length,
        phase: state.phase,
        bigBlind: state.bigBlind,
        activeModifiers: state.activeModifiers,
      };
    })
  );
  return NextResponse.json(rooms.filter(Boolean));
}

export async function POST(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: '닉네임 정보가 없습니다. 처음부터 다시 시작해주세요.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const roomName: string = (body.roomName || `${identity.nickname}의 테이블`).slice(0, 30);
  const smallBlind: number = Number(body.smallBlind) || 5;
  const bigBlind: number = Number(body.bigBlind) || 10;
  const activeModifiers: string[] = Array.isArray(body.activeModifiers) ? body.activeModifiers : [];

  const roomId = nanoid(8);
  const initialState: GameState = createInitialGameState({
    roomId,
    roomName,
    hostId: identity.userId,
    smallBlind,
    bigBlind,
    activeModifiers,
  });

  await saveRoom(roomId, initialState);
  await registerRoom(roomId);

  const pusherServer = getPusherServer();
  await pusherServer.trigger(CHANNELS.lobby, EVENTS.ROOM_LIST_UPDATED, {
    roomId,
    roomName,
  });

  return NextResponse.json({ roomId });
}
