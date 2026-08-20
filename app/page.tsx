'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function setCookie(name: string, value: string, days = 1) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function EntryPage() {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    // 이미 닉네임/세션이 있으면 바로 로비로
    const existingNickname = getCookie('nickname');
    if (existingNickname) setNickname(existingNickname);
  }, []);

  const handleEnter = () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    if (trimmed.length > 12) {
      setError('닉네임은 12자 이하로 입력해주세요.');
      return;
    }

    setCookie('nickname', trimmed, 1);
    if (!getCookie('userId')) {
      setCookie('userId', crypto.randomUUID(), 1);
    }
    router.push('/lobby');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-felt-900 to-felt-950 px-4">
      <div className="bg-white/10 backdrop-blur rounded-2xl p-8 w-full max-w-sm space-y-4 border border-white/10">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-white">🃏 Poker Night</h1>
          <p className="text-white/60 text-sm">친구들과 즐기는 캐주얼 텍사스 홀덤</p>
        </div>
        <input
          className="w-full px-4 py-3 rounded-lg bg-white/90 text-black outline-none focus:ring-2 focus:ring-yellow-400"
          placeholder="닉네임을 입력하세요"
          value={nickname}
          onChange={e => {
            setNickname(e.target.value);
            setError('');
          }}
          onKeyDown={e => e.key === 'Enter' && handleEnter()}
          maxLength={12}
          autoFocus
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleEnter}
          className="w-full py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 active:scale-[0.98] font-semibold transition"
        >
          입장하기
        </button>
      </div>
    </div>
  );
}
