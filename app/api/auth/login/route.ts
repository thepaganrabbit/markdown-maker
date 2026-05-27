import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { User } from '@/lib/types';
import {
  comparePassword,
  createAccessToken,
  createRefreshToken,
  refreshCookieOptions,
  refreshTokenExpiresAt
} from '@/lib/auth';
import { accessCookieOptions } from '@/lib/authCookies';
import { ensureCsrfCookie } from '@/lib/csrf';
import { createSession } from '@/lib/session';
import { parseJson, loginSchema } from '@/lib/validation';
import { jwtEnabled } from '@/lib/oauth2';
import { rateLimit } from '@/lib/security';

export async function POST(request: Request) {
  if (!jwtEnabled()) {
    return NextResponse.json({ error: 'JWT auth is disabled' }, { status: 403 });
  }

  const limited = rateLimit(request, { keyPrefix: 'auth:login', windowMs: 60_000, limit: 15 });
  if (limited) return limited;

  const { data, error } = await parseJson(request, loginSchema);
  if (error) return error;

  const db = await getDb();
  const users = db.collection<User>('users');

  const user = await users.findOne({ email: data.email });
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const isValid = await comparePassword(data.password, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const userId = user._id!.toString();
  const accessToken = createAccessToken(userId, user.email);
  const refreshToken = createRefreshToken(userId, user.email);
  const refreshExpiresAt = refreshTokenExpiresAt();

  await createSession(userId, refreshToken, refreshExpiresAt);

  const response = NextResponse.json({
    accessToken,
    user: { id: userId, email: user.email, role: user.role }
  });
  response.cookies.set('refreshToken', refreshToken, refreshCookieOptions());
  response.cookies.set('accessToken', accessToken, accessCookieOptions());
  ensureCsrfCookie(response);
  return response;
}
