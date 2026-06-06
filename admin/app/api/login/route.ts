import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS } from '@/lib/admin-session';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get('email') || form.get('username') || '').trim();
  const password = String(form.get('password') || '');

  try {
    const response = NextResponse.redirect(new URL('/', request.url), 303);
    const supabase = createSupabaseRouteClient(request, response);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message = error.message.toLowerCase();
      const code = message.includes('email not confirmed')
        ? 'unconfirmed'
        : message.includes('invalid login credentials')
          ? 'credentials'
          : message.includes('rate limit')
            ? 'rate'
            : 'auth';

      return NextResponse.redirect(new URL(`/login?error=${code}`, request.url), 303);
    }
    response.cookies.set(ADMIN_SESSION_COOKIE, '1', {
      httpOnly: true,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: request.url.startsWith('https://')
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=config', request.url), 303);
  }
}
