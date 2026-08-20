import { NextRequest, NextResponse } from 'next/server';
import { getPusherServer } from '@/lib/pusher';
import { getIdentity } from '@/lib/identity';

export async function POST(req: NextRequest) {
  const identity = getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: 'No identity cookies found' }, { status: 401 });
  }

  const formData = await req.formData();
  const socketId = formData.get('socket_id') as string;
  const channelName = formData.get('channel_name') as string;

  if (!socketId || !channelName) {
    return NextResponse.json({ error: 'Missing socket_id or channel_name' }, { status: 400 });
  }

  const pusherServer = getPusherServer();
  if (!pusherServer) {
    return NextResponse.json(
      { error: 'Pusher 서버 환경변수가 설정되지 않았습니다. Vercel 프로젝트의 환경변수를 확인해주세요.' },
      { status: 500 }
    );
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
    user_id: identity.userId,
    user_info: { nickname: identity.nickname },
  });

  return NextResponse.json(authResponse);
}
