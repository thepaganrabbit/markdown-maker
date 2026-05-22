import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessTokenEdge } from '@/lib/authEdge';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute =
    pathname.startsWith('/users') || pathname.startsWith('/admin') || pathname.startsWith('/settings');
  if (!protectedRoute) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('accessToken')?.value;
  const payload = accessToken ? await verifyAccessTokenEdge(accessToken) : null;
  if (!payload) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/users/:path*', '/admin/:path*', '/settings/:path*']
};
