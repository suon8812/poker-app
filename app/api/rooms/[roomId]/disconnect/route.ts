import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/kv';
import { getPusherServer, safeTrigger, CHANNELS, EVENTS } from '@/lib/pusher';
import { markPlayerDisconnected } from '@/lib/poker/gameEngine';

/**
 * Pusher presence 채널에서 pusher:member_removed 이벤트를 감지한
 * 다른 클라이언트가 호출합니다. (탭 종료, 네트워크 끊김 등으로
 * beforeunload가 정상 발화하지 않은 경우를 보완하는 용도)
 * 실제 게임 로직(폴드 처리)은 턴 타임아웃에서 담당하고,
 * 여기서는 'connected: false' 플래그만 갱신해 UI에 반영합니다.
 */
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const body = await req.json().catch(() => ({}));
  const disconnectedUserId: string | undefined = body.userId;
  if (!disconnectedUserId) {
    return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
  }

  const state = await getRoom(params.roomId);
  if (!state) return NextResponse.json({ success: true });

  const player = state.players.find(p => p.id === disconnectedUserId);
  if (!player || !player.connected) {
    return NextResponse.json({ success: true, changed: false });
  }

  const newState = markPlayerDisconnected(state, disconnectedUserId);
  await saveRoom(params.roomId, newState);

  const pusherServer = getPusherServer();
  await safeTrigger(pusherServer, CHANNELS.room(params.roomId), EVENTS.GAME_STATE_UPDATED, newState);

  return NextResponse.json({ success: true, changed: true });
}
