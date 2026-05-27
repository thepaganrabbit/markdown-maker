import { ObjectId } from 'mongodb';
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
import { ensureCsrfCookie } from '@/lib/csrf';
import { getDb } from '@/lib/mongodb';
import type { User } from '@/lib/types';
import { findSession, replaceSession } from '@/lib/session';
import { rateLimit } from '@/lib/security';

export async function POST(request: Request) {
  const limited = rateLimit(request, { keyPrefix: 'auth:refresh', windowMs: 60_000, limit: 20 });
  if (limited) return limited;

  const refreshToken = cookies().get('refreshToken')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 });
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
  }

  const existingSession = await findSession(refreshToken);
  // Require both a valid JWT and a live server-side session record.
  if (!existingSession || existingSession.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const db = await getDb();
  const users = db.collection<User>('users');
  const dbUser = ObjectId.isValid(payload.sub) ? await users.findOne({ _id: new ObjectId(payload.sub) }) : null;
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  const newAccessToken = createAccessToken(payload.sub, payload.email);
  const newRefreshToken = createRefreshToken(payload.sub, payload.email);
  const newRefreshExpiresAt = refreshTokenExpiresAt();

  // Rotate refresh token on every refresh to reduce replay risk.
  await replaceSession(refreshToken, newRefreshToken, newRefreshExpiresAt);

  const response = NextResponse.json({
    accessToken: newAccessToken,
    user: { id: payload.sub, email: payload.email, role: dbUser.role }
  });
  response.cookies.set('refreshToken', newRefreshToken, refreshCookieOptions());
  response.cookies.set('accessToken', newAccessToken, accessCookieOptions());
  ensureCsrfCookie(response);
  return response;
}
