import { NextRequest, NextResponse } from 'next/server';

const publicPaths = ['/login', '/forgot-password', '/reset-password', '/auth/callback'];

const hasSupabaseAuthCookie = (request: NextRequest) =>
  request.cookies.getAll().some(cookie =>
    cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token') && cookie.value
  );

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/')) return NextResponse.next();
  if (publicPaths.includes(pathname)) return NextResponse.next();

  if (!hasSupabaseAuthCookie(request)) return NextResponse.redirect(new URL('/login', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!favicon.ico).*)']
};
