import { NextRequest } from 'next/server';

export interface Identity {
  userId: string;
  nickname: string;
}

/** 요청 쿠키에서 닉네임/사용자 ID를 읽습니다. 없으면 null 반환 */
export function getIdentity(req: NextRequest): Identity | null {
  const userId = req.cookies.get('userId')?.value;
  const nickname = req.cookies.get('nickname')?.value;
  if (!userId || !nickname) return null;
  return { userId, nickname: decodeURIComponent(nickname) };
}
