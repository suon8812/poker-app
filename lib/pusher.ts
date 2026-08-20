import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

export function getPusherServer() {
  return new PusherServer({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
  });
}

let clientSingleton: PusherClient | null = null;

/** 클라이언트 싱글톤 - 페이지 전환 시 중복 연결 방지 */
export function getPusherClient(): PusherClient {
  if (typeof window === 'undefined') {
    throw new Error('getPusherClient can only be called on the client');
  }
  if (!clientSingleton) {
    clientSingleton = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
    });
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
