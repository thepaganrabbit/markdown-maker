import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

const OAUTH2_STATE_COOKIE = 'oauth2State';

export function oauth2Enabled() {
  return env.AUTH_MODE === 'oauth2' || env.AUTH_MODE === 'both';
}

export function jwtEnabled() {
  return env.AUTH_MODE === 'jwt' || env.AUTH_MODE === 'both';
}

export function assertOAuth2Config() {
  const required = [
    env.OAUTH2_AUTHORIZATION_ENDPOINT,
    env.OAUTH2_TOKEN_ENDPOINT,
    env.OAUTH2_CLIENT_ID,
    env.OAUTH2_CLIENT_SECRET,
    env.OAUTH2_CALLBACK_URL
  ];
  if (required.some((value) => !value)) {
    throw new Error('OAuth2 is enabled but one or more required OAuth2 env vars are missing');
  }
}

export function createOAuth2AuthUrl() {
  assertOAuth2Config();
  const state = crypto.randomBytes(24).toString('hex');
  const url = new URL(env.OAUTH2_AUTHORIZATION_ENDPOINT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.OAUTH2_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.OAUTH2_CALLBACK_URL);
  url.searchParams.set('scope', env.OAUTH2_SCOPE);
  url.searchParams.set('state', state);
  return { url: url.toString(), state };
}

export function setOAuth2StateCookie(response: NextResponse, state: string) {
  response.cookies.set(OAUTH2_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60
  });
}

export function readOAuth2StateCookie() {
  return cookies().get(OAUTH2_STATE_COOKIE)?.value;
}

export async function exchangeCodeForToken(code: string) {
  assertOAuth2Config();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.OAUTH2_CALLBACK_URL,
    client_id: env.OAUTH2_CLIENT_ID,
    client_secret: env.OAUTH2_CLIENT_SECRET
  });

  const response = await fetch(env.OAUTH2_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    throw new Error('OAuth2 token exchange failed');
  }

  return (await response.json()) as { access_token: string; id_token?: string; refresh_token?: string };
}

export async function fetchOAuth2User(token: string) {
  if (!env.OAUTH2_USERINFO_ENDPOINT) {
    return null;
  }
  const response = await fetch(env.OAUTH2_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { sub?: string; email?: string };
  if (!json.sub || !json.email) return null;
  return { sub: json.sub, email: json.email.toLowerCase() };
}
