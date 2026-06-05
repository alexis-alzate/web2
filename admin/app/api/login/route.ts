import { NextResponse } from 'next/server';
import { createSession, verifyPassword } from '@/lib/auth';

export async function POST(request: Request) {
  const form = await request.formData();
  const username = String(form.get('username') || '');
  const password = String(form.get('password') || '');

  if (!verifyPassword(username, password)) {
    return NextResponse.redirect(new URL('/login?error=1', request.url));
  }

  await createSession(username);
  return NextResponse.redirect(new URL('/', request.url));
}
