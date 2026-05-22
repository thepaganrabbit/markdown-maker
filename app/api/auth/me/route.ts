import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
  const cookieToken = cookies().get('accessToken')?.value;

  const token = headerToken ?? cookieToken;
  if (!token) {
    return NextResponse.json({ error: 'Missing access token' }, { status: 401 });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
  }

  return NextResponse.json({ user: { id: payload.sub, email: payload.email } });
}
