import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/kv';
import { getPusherServer, CHANNELS, EVENTS } from '@/lib/pusher';
import { getIdentity } from '@/lib/identity';
import { startNewHand } from '@/lib/poker/gameEngine';
import { pruneStalePlayers } from '@/lib/store/roomStore';

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const identity = getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: '닉네임 정보가 없습니다.' }, { status: 401 });
  }

  const state = await getRoom(params.roomId);
  if (!state) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (state.phase !== 'waiting' && state.phase !== 'handOver') {
    return NextResponse.json({ error: '이미 핸드가 진행 중입니다.' }, { status: 409 });
  }

  const activePlayerCount = state.players.filter(p => p.chips > 0).length;
  if (activePlayerCount < 2) {
    return NextResponse.json({ error: '최소 2명의 플레이어(칩 보유)가 필요합니다.' }, { status: 400 });
  }

  const cleaned = pruneStalePlayers(state);
  const newState = startNewHand(cleaned);
  await saveRoom(params.roomId, newState);

  const pusherServer = getPusherServer();
  await pusherServer.trigger(CHANNELS.room(params.roomId), EVENTS.GAME_STATE_UPDATED, newState);

  return NextResponse.json({ success: true, state: newState });
}
