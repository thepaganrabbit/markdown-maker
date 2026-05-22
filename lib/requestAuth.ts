import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth';

export function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
  const cookieToken = cookies().get('accessToken')?.value;

  const token = headerToken ?? cookieToken;
  if (!token) return null;

  return verifyAccessToken(token);
}
