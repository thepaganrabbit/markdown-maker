import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';
import { fetchOAuth2User, oauth2Enabled } from '@/lib/oauth2';

export async function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
  const cookieToken = cookies().get('accessToken')?.value;

  const token = headerToken ?? cookieToken;
  if (!token) return null;

  const jwtPayload = verifyAccessToken(token);
  if (jwtPayload) return jwtPayload;

  if (headerToken && oauth2Enabled()) {
    const oauthUser = await fetchOAuth2User(headerToken);
    if (oauthUser) {
      return { sub: oauthUser.sub, email: oauthUser.email, type: 'access' as const, exp: Number.MAX_SAFE_INTEGER };
    }
  }

  return null;
}
