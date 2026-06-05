import { NextRequest, NextResponse } from 'next/server';

const publicPaths = ['/login'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/login')) return NextResponse.next();
  if (publicPaths.includes(pathname)) return NextResponse.next();

  const session = request.cookies.get('lujo_admin_session')?.value;
  if (!session) return NextResponse.redirect(new URL('/login', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!favicon.ico).*)']
};
