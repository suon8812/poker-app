import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/kv';

export async function GET(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const state = await getRoom(params.roomId);
  if (!state) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
  }
  return NextResponse.json(state);
}
