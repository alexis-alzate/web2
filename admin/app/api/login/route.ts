import { NextResponse } from 'next/server';
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
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=config', request.url), 303);
  }
}
