'use client';

import { useState } from 'react';

interface Props {
  roomId: string;
  currentMaxBet: number;
  minRaise: number;
  myChips: number;
  myBet: number;
  onError: (msg: string) => void;
}

export default function BettingControls({ roomId, currentMaxBet, minRaise, myChips, myBet, onError }: Props) {
  const minRaiseTotal = Math.min(currentMaxBet + minRaise, myBet + myChips);
  const maxRaiseTotal = myBet + myChips; // 올인까지
  const [raiseAmount, setRaiseAmount] = useState(minRaiseTotal);
  const [sending, setSending] = useState(false);

  const callAmount = Math.min(currentMaxBet - myBet, myChips);

  const sendAction = async (action: string, amount?: number) => {
    setSending(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount }),
      });
      const data = await res.json();
      if (!res.ok) onError(data.error || '액션을 처리할 수 없습니다.');
    } catch {
      onError('네트워크 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  const canRaise = maxRaiseTotal > currentMaxBet;

  return (
    <div className="mt-4 bg-white/10 rounded-xl p-4 flex flex-wrap gap-3 items-center">
      <button
        onClick={() => sendAction('fold')}
        disabled={sending}
        className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-medium disabled:opacity-50"
      >
        폴드
      </button>

      {callAmount === 0 ? (
        <button
          onClick={() => sendAction('check')}
          disabled={sending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium disabled:opacity-50"
        >
          체크
        </button>
      ) : (
        <button
          onClick={() => sendAction('call')}
          disabled={sending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium disabled:opacity-50"
        >
          콜 ({callAmount})
        </button>
      )}

      {canRaise && (
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <input
            type="range"
            min={minRaiseTotal}
            max={maxRaiseTotal}
            value={Math.min(raiseAmount, maxRaiseTotal)}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-white text-sm w-12 text-right">{raiseAmount}</span>
        </div>
      )}

      {canRaise && (
        <button
          onClick={() => sendAction('raise', Math.min(raiseAmount, maxRaiseTotal))}
          disabled={sending}
          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 rounded-lg text-black font-semibold disabled:opacity-50"
        >
          {raiseAmount >= maxRaiseTotal ? '올인' : '레이즈'}
        </button>
      )}
    </div>
  );
}
