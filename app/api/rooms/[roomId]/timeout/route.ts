import { NextRequest, NextResponse } from 'next/server';
import { getRoom, saveRoom } from '@/lib/kv';
import { getPusherServer, safeTrigger, CHANNELS, EVENTS } from '@/lib/pusher';
import { handleTurnTimeout } from '@/lib/poker/gameEngine';

/**
 * 서버리스 환경에는 백그라운드 타이머가 없으므로,
 * 클라이언트가 turnDeadline 초과를 감지하면 이 엔드포인트를 호출해
 * 정체된 턴을 강제로 정리(체크 또는 폴드)합니다.
 * handleTurnTimeout은 데드라인 이전이면 상태를 그대로 반환하므로 중복 호출해도 안전합니다.
 */
export async function POST(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const state = await getRoom(params.roomId);
  if (!state) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
  }

  const newState = handleTurnTimeout(state);

  if (newState === state) {
    return NextResponse.json({ success: true, changed: false, state });
  }

  await saveRoom(params.roomId, newState);

  const pusherServer = getPusherServer();
  await safeTrigger(pusherServer, CHANNELS.room(params.roomId), EVENTS.GAME_STATE_UPDATED, newState);

  return NextResponse.json({ success: true, changed: true, state: newState });
}
