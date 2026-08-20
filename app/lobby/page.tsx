'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPusherClient, CHANNELS, EVENTS } from '@/lib/pusher';

interface RoomSummary {
  roomId: string;
  roomName: string;
  playerCount: number;
  phase: string;
  bigBlind: number;
  activeModifiers: string[];
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const PHASE_LABELS: Record<string, string> = {
  waiting: '대기 중',
  preflop: '진행 중',
  flop: '진행 중',
  turn: '진행 중',
  river: '진행 중',
  showdown: '진행 중',
  handOver: '핸드 종료',
};

export default function LobbyPage() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [bigBlind, setBigBlind] = useState(10);
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [listError, setListError] = useState('');
  const router = useRouter();

  const refreshRooms = () => {
    fetch('/api/rooms')
      .then(async r => {
        const data = await r.json();
        if (!r.ok || !Array.isArray(data)) {
          throw new Error(data?.error || '방 목록을 불러오지 못했습니다.');
        }
        setRooms(data);
        setListError('');
      })
      .catch(err => setListError(err.message));
  };

  useEffect(() => {
    const nick = getCookie('nickname');
    if (!nick) {
      router.replace('/');
      return;
    }
    setNickname(nick);

    refreshRooms();

    // Pusher 설정이 잘못되어도 로비 자체는 폴링으로 계속 동작하도록 격리
    let cleanupPusher: (() => void) | null = null;
    try {
      const pusher = getPusherClient();
      const channel = pusher.subscribe(CHANNELS.lobby);
      channel.bind(EVENTS.ROOM_LIST_UPDATED, refreshRooms);
      cleanupPusher = () => {
        channel.unbind(EVENTS.ROOM_LIST_UPDATED, refreshRooms);
        pusher.unsubscribe(CHANNELS.lobby);
      };
    } catch (err) {
      console.error('[lobby] Pusher 연결 실패, 폴링으로 대체합니다:', err);
    }

    const interval = setInterval(refreshRooms, 5000); // 실시간 갱신이 안 될 경우를 위한 폴백 폴링

    return () => {
      cleanupPusher?.();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createRoom = async () => {
    setLoading(true);
    setCreateError('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomName || `${nickname}의 테이블`,
          smallBlind: Math.floor(bigBlind / 2),
          bigBlind,
        }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error(`서버 오류가 발생했습니다 (상태 코드 ${res.status}). Vercel 배포 로그를 확인해주세요.`);
      }

      if (!res.ok || !data.roomId) {
        throw new Error(data?.error || '방을 만들지 못했습니다.');
      }

      router.push(`/room/${data.roomId}`);
    } catch (err: any) {
      setCreateError(err.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-felt-950 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">🃏 로비</h1>
          <span className="text-white/60 text-sm">{nickname}님 환영합니다</span>
        </header>

        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 rounded-xl font-semibold transition"
        >
          + 새 테이블 만들기
        </button>

        {listError && (
          <div className="bg-red-950/50 border border-red-500/30 rounded-xl p-3 text-red-300 text-sm">
            ⚠ {listError}
          </div>
        )}

        <div className="grid gap-3">
          {rooms.map(room => (
            <button
              key={room.roomId}
              onClick={() => router.push(`/room/${room.roomId}`)}
              className="bg-white/10 hover:bg-white/20 transition rounded-xl p-4 flex justify-between items-center text-white text-left"
            >
              <div>
                <p className="font-semibold">{room.roomName}</p>
                <p className="text-white/50 text-sm">
                  블라인드 {room.bigBlind / 2}/{room.bigBlind} · {PHASE_LABELS[room.phase] ?? room.phase}
                  {room.activeModifiers.length > 0 && ` · 특수규칙 ${room.activeModifiers.length}개`}
                </p>
              </div>
              <span className="text-white/70 text-sm whitespace-nowrap">{room.playerCount}/9명</span>
            </button>
          ))}
          {rooms.length === 0 && (
            <p className="text-white/40 text-center py-12">생성된 방이 없습니다. 새 방을 만들어보세요!</p>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-felt-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold text-white">새 테이블 만들기</h2>
            <div className="space-y-2">
              <label className="text-white/60 text-sm">방 이름</label>
              <input
                className="w-full px-3 py-2 rounded-lg bg-white/90 text-black outline-none"
                placeholder={`${nickname}의 테이블`}
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <label className="text-white/60 text-sm">빅 블라인드</label>
              <div className="flex gap-2">
                {[10, 20, 50].map(bb => (
                  <button
                    key={bb}
                    onClick={() => setBigBlind(bb)}
                    className={`flex-1 py-2 rounded-lg font-medium transition ${
                      bigBlind === bb ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white'
                    }`}
                  >
                    {bb}
                  </button>
                ))}
              </div>
            </div>
            {createError && (
              <div className="bg-red-950/50 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
                ⚠ {createError}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-lg bg-white/10 text-white font-medium"
              >
                취소
              </button>
              <button
                onClick={createRoom}
                disabled={loading}
                className="flex-1 py-3 rounded-lg bg-yellow-500 text-black font-semibold disabled:opacity-50"
              >
                {loading ? '생성 중...' : '만들기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
