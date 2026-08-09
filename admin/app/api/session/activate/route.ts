import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE_SECONDS } from '@/lib/admin-session';
import { readAccessMetadata } from '@/lib/auth';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabase = createSupabaseRouteClient(request, response);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const access = readAccessMetadata(data.user);
  const allowed = (access.role === 'admin' && access.status === 'active')
    || (access.role === 'artist' && Boolean(access.artistSlug));
  if (!allowed) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  response.cookies.set(ADMIN_SESSION_COOKIE, '1', {
    httpOnly: true,
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: request.url.startsWith('https://')
  });

  return response;
}
