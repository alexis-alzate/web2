import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  const supabase = createSupabaseRouteClient(request, response);
  await supabase.auth.signOut();
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}
