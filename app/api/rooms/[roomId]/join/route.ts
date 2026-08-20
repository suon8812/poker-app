import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, registerRoom } from '@/lib/kv';
import { getPusherServer, CHANNELS, EVENTS } from '@/lib/pusher';
import { getIdentity } from '@/lib/identity';
import { joinRoom } from '@/lib/store/roomStore';

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const identity = getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: '닉네임 정보가 없습니다.' }, { status: 401 });
  }

  const state = await getRoom(params.roomId);
  if (!state) {
    return NextResponse.json({ error: '존재하지 않거나 만료된 방입니다.' }, { status: 404 });
  }

  let newState;
  try {
    newState = joinRoom(state, identity.userId, identity.nickname);
  } catch (err: any) {
    if (err.message === 'ROOM_FULL') {
      return NextResponse.json({ error: '방이 가득 찼습니다. (최대 9명)' }, { status: 409 });
    }
    throw err;
  }

  await saveRoom(params.roomId, newState);
  // 방 목록이 처음 생성 직후 아직 등록되지 않았을 수 있으므로 안전하게 재등록
  await registerRoom(params.roomId);

  const pusherServer = getPusherServer();
  await pusherServer.trigger(CHANNELS.room(params.roomId), EVENTS.GAME_STATE_UPDATED, newState);
  await pusherServer.trigger(CHANNELS.room(params.roomId), EVENTS.PLAYER_JOINED, {
    userId: identity.userId,
    nickname: identity.nickname,
  });
  await pusherServer.trigger(CHANNELS.lobby, EVENTS.ROOM_LIST_UPDATED, { roomId: params.roomId });

  return NextResponse.json({ success: true, state: newState });
}
