'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPusherClient, CHANNELS, EVENTS } from '@/lib/pusher';
import { GameState } from '@/lib/poker/types';
import PokerTable from '@/components/PokerTable';
import BettingControls from '@/components/BettingControls';
import ActionLog from '@/components/ActionLog';
import HandRankHint from '@/components/HandRankHint';
import Toasts from '@/components/Toasts';
import { useUIStore } from '@/lib/store/uiStore';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const [state, setState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const router = useRouter();
  const pushToast = useUIStore(s => s.pushToast);
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;

  // ===== 입장 + 실시간 구독 + presence 처리 =====
  useEffect(() => {
    const userId = getCookie('userId');
    const nickname = getCookie('nickname');
    if (!userId || !nickname) {
      router.replace('/');
      return;
    }
    setMyId(userId);

    let active = true;

    fetch(`/api/rooms/${roomId}/join`, { method: 'POST' })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || '입장에 실패했습니다.');
        if (active) setState(data.state);
      })
      .catch(err => active && setError(err.message));

    const pusher = getPusherClient();
    const channel = pusher.subscribe(CHANNELS.room(roomId));

    channel.bind(EVENTS.GAME_STATE_UPDATED, (newState: GameState) => {
      if (active) setState(newState);
    });
    channel.bind(EVENTS.PLAYER_JOINED, (data: { nickname: string }) => {
      pushToast(`${data.nickname}님이 입장했습니다.`);
    });
    channel.bind(EVENTS.PLAYER_LEFT, (data: { nickname: string }) => {
      pushToast(`${data.nickname}님이 퇴장했습니다.`);
    });

    // presence 채널: 다른 유저의 연결 끊김을 감지해 서버에 알림 (재접속 처리 보완)
    channel.bind('pusher:member_removed', (member: { id: string }) => {
      fetch(`/api/rooms/${roomId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id }),
      }).catch(() => {});
    });

    const leaveBeacon = () => {
      navigator.sendBeacon?.(`/api/rooms/${roomId}/leave`, new Blob([], { type: 'application/json' }));
    };
    window.addEventListener('beforeunload', leaveBeacon);

    return () => {
      active = false;
      channel.unbind_all();
      pusher.unsubscribe(CHANNELS.room(roomId));
      window.removeEventListener('beforeunload', leaveBeacon);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ===== 턴 타임아웃 감시 (클라이언트가 데드라인 초과를 감지하면 서버에 정리 요청) =====
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!state?.turnDeadline) return;
    if (now < state.turnDeadline) return;
    fetch(`/api/rooms/${roomId}/timeout`, { method: 'POST' }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, state?.turnDeadline]);

  const leaveRoom = async () => {
    await fetch(`/api/rooms/${roomId}/leave`, { method: 'POST' }).catch(() => {});
    router.push('/lobby');
  };

  const startHand = async () => {
    const res = await fetch(`/api/rooms/${roomId}/start`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) pushToast(data.error || '핸드를 시작할 수 없습니다.');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-felt-950 flex flex-col items-center justify-center gap-4 text-white p-6 text-center">
        <p>{error}</p>
        <button onClick={() => router.push('/lobby')} className="px-4 py-2 bg-yellow-500 rounded-lg text-black font-semibold">
          로비로 돌아가기
        </button>
      </div>
    );
  }

  if (!state) {
    return <div className="min-h-screen bg-felt-950 flex items-center justify-center text-white">로딩 중...</div>;
  }

  const me = state.players.find(p => p.id === myId);
  const isMyTurn = state.players[state.turnIndex]?.id === myId && state.phase !== 'waiting' && state.phase !== 'handOver';
  const isHost = state.hostId === myId;
  const canStart = (state.phase === 'waiting' || state.phase === 'handOver') && state.players.filter(p => p.chips > 0).length >= 2;

  return (
    <div className="min-h-screen bg-felt-950 flex flex-col lg:flex-row">
      <Toasts />
      <div className="flex-1 p-3 sm:p-4 flex flex-col">
        <header className="flex justify-between items-center mb-3">
          <h1 className="text-white font-bold truncate">{state.roomName}</h1>
          <button onClick={leaveRoom} className="text-white/60 hover:text-white text-sm px-3 py-1 rounded-lg bg-white/10">
            나가기
          </button>
        </header>

        <PokerTable state={state} myId={myId} now={now} />

        {me && (state.phase !== 'waiting' || me.holeCards.length > 0) && (
          <HandRankHint holeCards={me.holeCards} communityCards={state.communityCards} />
        )}

        {isMyTurn && me && (
          <BettingControls
            roomId={roomId}
            currentMaxBet={state.currentMaxBet}
            minRaise={state.minRaise}
            myChips={me.chips}
            myBet={me.currentBet}
            onError={msg => pushToast(msg)}
          />
        )}

        {canStart && (
          <div className="mt-4">
            {isHost ? (
              <button
                onClick={startHand}
                className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 rounded-xl font-semibold transition"
              >
                {state.handNumber === 0 ? '게임 시작' : '다음 핸드 시작'}
              </button>
            ) : (
              <p className="text-center text-white/50 text-sm py-2">방장이 다음 핸드를 시작하길 기다리는 중...</p>
            )}
          </div>
        )}

        {state.winners && state.winners.length > 0 && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <p className="text-yellow-400 font-bold mb-1">🏆 핸드 결과</p>
            {state.winners.map((w, i) => (
              <p key={i} className="text-white text-sm">
                {w.nickname} — {w.handDescription} (+{w.potWon} 칩)
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="w-full lg:w-80 bg-black/30 p-4 overflow-y-auto max-h-72 lg:max-h-none border-t lg:border-t-0 lg:border-l border-white/10">
        <ActionLog log={state.actionLog} phase={state.phase} />
      </div>
    </div>
  );
}
