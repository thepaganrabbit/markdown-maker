import { NextResponse } from 'next/server';
import { createOAuth2AuthUrl, oauth2Enabled, setOAuth2StateCookie } from '@/lib/oauth2';

export async function GET() {
  if (!oauth2Enabled()) {
    return NextResponse.json({ error: 'OAuth2 auth is disabled' }, { status: 403 });
  }

  const { url, state } = createOAuth2AuthUrl();
  const response = NextResponse.redirect(url);
  setOAuth2StateCookie(response, state);
  return response;
}
