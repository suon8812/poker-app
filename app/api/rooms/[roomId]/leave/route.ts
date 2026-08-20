import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom, removeRoom } from '@/lib/kv';
import { getPusherServer, CHANNELS, EVENTS } from '@/lib/pusher';
import { getIdentity } from '@/lib/identity';
import { leaveRoom, isRoomEmpty } from '@/lib/store/roomStore';

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const identity = getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: '닉네임 정보가 없습니다.' }, { status: 401 });
  }

  const state = await getRoom(params.roomId);
  if (!state) {
    return NextResponse.json({ success: true }); // 이미 없는 방이면 조용히 성공 처리
  }

  const newState = leaveRoom(state, identity.userId);

  const pusherServer = getPusherServer();

  if (isRoomEmpty(newState)) {
    await removeRoom(params.roomId);
    await pusherServer.trigger(CHANNELS.lobby, EVENTS.ROOM_LIST_UPDATED, { roomId: params.roomId, removed: true });
    return NextResponse.json({ success: true });
  }

  await saveRoom(params.roomId, newState);
  await pusherServer.trigger(CHANNELS.room(params.roomId), EVENTS.GAME_STATE_UPDATED, newState);
  await pusherServer.trigger(CHANNELS.room(params.roomId), EVENTS.PLAYER_LEFT, {
    userId: identity.userId,
    nickname: identity.nickname,
  });
  await pusherServer.trigger(CHANNELS.lobby, EVENTS.ROOM_LIST_UPDATED, { roomId: params.roomId });

  return NextResponse.json({ success: true });
}
