import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  createAccessToken,
  createRefreshToken,
  refreshCookieOptions,
  refreshTokenExpiresAt,
  verifyRefreshToken
} from '@/lib/auth';
import { accessCookieOptions } from '@/lib/authCookies';
import { findSession, replaceSession } from '@/lib/session';

export async function POST() {
  const refreshToken = cookies().get('refreshToken')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
  }

  const existingSession = await findSession(refreshToken);
  if (!existingSession || existingSession.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const newAccessToken = createAccessToken(payload.sub, payload.email);
  const newRefreshToken = createRefreshToken(payload.sub, payload.email);
  const newRefreshExpiresAt = refreshTokenExpiresAt();

  await replaceSession(refreshToken, newRefreshToken, newRefreshExpiresAt);

  const response = NextResponse.json({
    accessToken: newAccessToken,
    user: { id: payload.sub, email: payload.email }
  });
  response.cookies.set('refreshToken', newRefreshToken, refreshCookieOptions());
  response.cookies.set('accessToken', newAccessToken, accessCookieOptions());
  return response;
}
