import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import type { User } from '@/lib/models';
import { accessCookieOptions } from '@/lib/authCookies';
import {
  createAccessToken,
  createRefreshToken,
  hashPassword,
  refreshCookieOptions,
  refreshTokenExpiresAt
} from '@/lib/auth';
import { ensureCsrfCookie } from '@/lib/csrf';
import {
  exchangeCodeForToken,
  fetchOAuth2User,
  oauth2Enabled,
  readOAuth2StateCookie
} from '@/lib/oauth2';
import { createSession } from '@/lib/session';

export async function GET(request: Request) {
  if (!oauth2Enabled()) {
    return NextResponse.json({ error: 'OAuth2 auth is disabled' }, { status: 403 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = readOAuth2StateCookie();

  // OAuth2 state must round-trip via cookie to prevent CSRF/login injection.
  if (!code || !state || !stateCookie || state !== stateCookie) {
    return NextResponse.json({ error: 'Invalid OAuth2 callback state' }, { status: 400 });
  }

  const token = await exchangeCodeForToken(code);
  const oauthUser = await fetchOAuth2User(token.access_token);
  if (!oauthUser) {
    return NextResponse.json({ error: 'Failed to resolve OAuth2 user profile' }, { status: 401 });
  }

  const db = await getDb();
  const users = db.collection<User>('users');

  let user = await users.findOne({ email: oauthUser.email });
  if (!user) {
    const passwordHash = await hashPassword(crypto.randomUUID());
    const createdAt = new Date();
    const created = await users.insertOne({
      email: oauthUser.email,
      passwordHash,
      role: 'user',
      createdAt
    });
    user = {
      _id: created.insertedId,
      email: oauthUser.email,
      passwordHash,
      role: 'user',
      createdAt
    };
  }

  const userId = user._id!.toString();
  const accessToken = createAccessToken(userId, user.email);
  const refreshToken = createRefreshToken(userId, user.email);
  const refreshExpiresAt = refreshTokenExpiresAt();

  await createSession(userId, refreshToken, refreshExpiresAt);

  const response = NextResponse.redirect(new URL('/users', request.url));
  response.cookies.set('refreshToken', refreshToken, refreshCookieOptions());
  response.cookies.set('accessToken', accessToken, accessCookieOptions());
  // One-time state cookie: clear it after successful callback handling.
  response.cookies.set('oauth2State', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  ensureCsrfCookie(response);
  return response;
}
