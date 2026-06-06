import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS } from '@/lib/admin-session';

const hasSupabaseAuthCookie = (request: NextRequest) =>
  request.cookies.getAll().some(cookie =>
    cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token') && cookie.value
  );

export async function POST(request: NextRequest) {
  if (!hasSupabaseAuthCookie(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, '1', {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: request.url.startsWith('https://')
  });

  return response;
}
