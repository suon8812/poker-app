import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/kv';
import { getPusherServer, CHANNELS, EVENTS } from '@/lib/pusher';
import { getIdentity } from '@/lib/identity';
import { applyAction, handleTurnTimeout } from '@/lib/poker/gameEngine';
import { ActionType } from '@/lib/poker/types';

const VALID_ACTIONS: ActionType[] = ['check', 'call', 'raise', 'fold'];

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const identity = getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: '닉네임 정보가 없습니다.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action: ActionType = body.action;
  const amount: number | undefined = body.amount !== undefined ? Number(body.amount) : undefined;

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: '유효하지 않은 액션입니다.' }, { status: 400 });
  }

  let state = await getRoom(params.roomId);
  if (!state) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 먼저 타임아웃된 턴이 있는지 확인 후 정리 (밀린 액션 방지)
  state = handleTurnTimeout(state);

  const player = state.players.find(p => p.id === identity.userId);
  if (!player) {
    return NextResponse.json({ error: '이 방의 플레이어가 아닙니다.' }, { status: 403 });
  }
  if (state.players[state.turnIndex]?.id !== identity.userId) {
    return NextResponse.json({ error: '지금은 당신의 턴이 아닙니다.' }, { status: 409 });
  }

  const newState = applyAction(state, identity.userId, action, amount);
  await saveRoom(params.roomId, newState);

  const pusherServer = getPusherServer();
  await pusherServer.trigger(CHANNELS.room(params.roomId), EVENTS.GAME_STATE_UPDATED, newState);

  return NextResponse.json({ success: true, state: newState });
}
