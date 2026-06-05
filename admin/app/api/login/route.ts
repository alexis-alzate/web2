import { NextResponse } from 'next/server';
import { cookieName, signSession, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get('username') || '');
  const password = String(form.get('password') || '');

  try {
    if (!verifyPassword(username, password)) {
      return NextResponse.redirect(new URL('/login?error=1', request.url), 303);
    }
  } catch {
    return NextResponse.redirect(new URL('/login?error=config', request.url), 303);
  }

  const response = NextResponse.redirect(new URL('/', request.url), 303);
  response.cookies.set(cookieName, `${username}.${signSession(username)}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12
  });
  return response;
}
