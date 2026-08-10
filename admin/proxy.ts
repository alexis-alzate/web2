import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session';

const publicPaths = ['/login', '/forgot-password', '/reset-password', '/auth/callback', '/auth/confirm'];

const isSupabaseAuthCookieName = (name: string) =>
  name.startsWith('sb-') && /-auth-token(?:\.\d+)?$/.test(name);

const hasSupabaseAuthCookie = (request: NextRequest) =>
  request.cookies.getAll().some(cookie => isSupabaseAuthCookieName(cookie.name) && cookie.value);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/')) return NextResponse.next();
  if (publicPaths.includes(pathname)) return NextResponse.next();

  const hasAdminSession = request.cookies.get(ADMIN_SESSION_COOKIE)?.value === '1';
  if (!hasAdminSession || !hasSupabaseAuthCookie(request)) {
    return NextResponse.redirect(new URL('/login?error=expired', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!favicon.ico).*)']
};
