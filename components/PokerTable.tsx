import { GameState } from '@/lib/poker/types';
import PlayingCard from './PlayingCard';
import clsx from 'clsx';

const PHASE_LABELS: Record<string, string> = {
  waiting: '플레이어 대기 중',
  preflop: '프리플랍',
  flop: '플랍',
  turn: '턴',
  river: '리버',
  showdown: '쇼다운',
  handOver: '핸드 종료',
};

export default function PokerTable({ state, myId, now }: { state: GameState; myId: string; now: number }) {
  const totalPot = state.pots.reduce((sum, p) => sum + p.amount, 0);
  const secondsLeft = state.turnDeadline ? Math.max(0, Math.ceil((state.turnDeadline - now) / 1000)) : null;

  return (
    <div className="bg-felt-900/60 border border-white/10 rounded-2xl p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <span className="text-white/70 text-sm font-medium">{PHASE_LABELS[state.phase] ?? state.phase}</span>
        <span className="text-yellow-400 font-bold">Pot: {totalPot}</span>
      </div>

      <div className="flex justify-center gap-2 mb-6 min-h-[3.5rem] sm:min-h-[5rem]">
        {state.communityCards.map((c, i) => (
          <PlayingCard key={i} card={c} />
        ))}
        {Array.from({ length: Math.max(0, 5 - state.communityCards.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="w-10 h-14 sm:w-14 sm:h-20 rounded-lg border-2 border-dashed border-white/10 shrink-0" />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {state.players.map((p, idx) => {
          const isMe = p.id === myId;
          const isTurn = state.turnIndex === idx && (state.phase !== 'waiting' && state.phase !== 'handOver');
          return (
            <div
              key={p.id}
              className={clsx(
                'rounded-xl p-3 flex items-center justify-between gap-2 transition',
                isTurn ? 'bg-yellow-500/20 ring-2 ring-yellow-400' : 'bg-white/5',
                p.status === 'folded' && 'opacity-40'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex gap-1">
                  <PlayingCard card={p.holeCards[0]} hidden={!isMe && p.holeCards.length > 0} />
                  <PlayingCard card={p.holeCards[1]} hidden={!isMe && p.holeCards.length > 0} />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm font-semibold truncate flex items-center gap-1">
                    {p.nickname}
                    {p.isDealer && <span className="text-[10px] bg-white/20 rounded px-1">D</span>}
                    {!p.connected && <span className="text-[10px] text-red-400">연결끊김</span>}
                  </p>
                  <p className="text-white/50 text-xs">
                    {p.chips} 칩
                    {p.currentBet > 0 && ` · 베팅 ${p.currentBet}`}
                  </p>
                  <p className="text-white/40 text-[10px] uppercase">{statusLabel(p.status)}</p>
                </div>
              </div>
              {isTurn && secondsLeft !== null && (
                <span className={clsx('text-xs font-mono shrink-0', secondsLeft <= 5 ? 'text-red-400' : 'text-yellow-300')}>
                  {secondsLeft}s
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return '진행중';
    case 'folded': return '폴드';
    case 'allin': return '올인';
    case 'sittingOut': return '대기';
    case 'disconnected': return '끊김';
    default: return status;
  }
}
