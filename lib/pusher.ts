import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

/**
 * 환경변수가 비어있으면(설정 누락) 여기서 바로 예외를 던지는 대신 null을 반환합니다.
 * 방 생성/입장/액션 같은 핵심 기능(KV 저장)은 Pusher 없이도 동작해야 하므로,
 * 실시간 브로드캐스트만 못하고 넘어가도록 하기 위함입니다.
 */
export function getPusherServer(): PusherServer | null {
  const { PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_CLUSTER } = process.env;

  if (!PUSHER_APP_ID || !NEXT_PUBLIC_PUSHER_KEY || !PUSHER_SECRET || !NEXT_PUBLIC_PUSHER_CLUSTER) {
    console.error(
      '[pusher] 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정 > Environment Variables 에서 ' +
        'PUSHER_APP_ID / NEXT_PUBLIC_PUSHER_KEY / PUSHER_SECRET / NEXT_PUBLIC_PUSHER_CLUSTER 를 확인하세요.'
    );
    return null;
  }

  try {
    return new PusherServer({
      appId: PUSHER_APP_ID,
      key: NEXT_PUBLIC_PUSHER_KEY,
      secret: PUSHER_SECRET,
      cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
      useTLS: true,
    });
  } catch (err) {
    console.error('[pusher] 서버 클라이언트 생성 실패:', err);
    return null;
  }
}

let clientSingleton: PusherClient | null = null;

/** 클라이언트 싱글톤 - 페이지 전환 시 중복 연결 방지 */
export function getPusherClient(): PusherClient {
  if (typeof window === 'undefined') {
    throw new Error('getPusherClient can only be called on the client');
  }
  if (!clientSingleton) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!key || !cluster) {
      throw new Error(
        'Pusher 환경변수(NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER)가 설정되지 않았습니다. ' +
          '.env.local 또는 Vercel 환경변수를 확인한 뒤 다시 배포(재빌드)해주세요. ' +
          'NEXT_PUBLIC_ 로 시작하는 값은 빌드 시점에 굳어지므로, 값을 나중에 바꿨다면 반드시 재배포해야 반영됩니다.'
      );
    }
    clientSingleton = new PusherClient(key, { cluster, authEndpoint: '/api/pusher/auth' });
  }
  return clientSingleton;
}

export const CHANNELS = {
  lobby: 'presence-lobby',
  room: (roomId: string) => `presence-room-${roomId}`,
};

export const EVENTS = {
  ROOM_LIST_UPDATED: 'room-list-updated',
  GAME_STATE_UPDATED: 'game-state-updated',
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
};

/**
 * Pusher 브로드캐스트가 실패해도(키 오타, 네트워크 문제 등) 실제 게임 진행(KV 저장)까지
 * 실패 처리되지 않도록 감싸는 헬퍼입니다. 실시간 알림만 잠깐 씹히고, 다음 폴링/새로고침 시
 * 정상 상태로 복구됩니다. 실패 시 서버 로그에 원인을 남겨 Vercel Functions 로그에서 확인 가능합니다.
 */
export async function safeTrigger(
  pusherServer: PusherServer | null,
  channel: string,
  event: string,
  data: unknown
): Promise<void> {
  if (!pusherServer) return; // getPusherServer()가 이미 원인을 로그로 남김
  try {
    await pusherServer.trigger(channel, event, data);
  } catch (err) {
    console.error(`[pusher] trigger failed (channel=${channel}, event=${event}):`, err);
  }
}
