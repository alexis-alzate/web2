import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS } from '@/lib/admin-session';
import { readAccessMetadata } from '@/lib/auth';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get('email') || form.get('username') || '').trim();
  const password = String(form.get('password') || '');

  try {
    const response = NextResponse.redirect(new URL('/', request.url), 303);
    const supabase = createSupabaseRouteClient(request, response);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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

    const access = data.user ? readAccessMetadata(data.user) : null;
    const destination = access?.role === 'admin' && access.status === 'active'
      ? '/'
      : access?.role === 'artist' && access.artistSlug
        ? '/mi-perfil'
        : null;

    if (!destination) {
      await supabase.auth.signOut();
      response.headers.set('location', new URL('/login?error=access', request.url).toString());
      return response;
    }

    response.headers.set('location', new URL(destination, request.url).toString());
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
