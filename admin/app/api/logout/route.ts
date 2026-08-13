import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin-session';
import {
  PORTAL_ACTIVITY_SESSION_COOKIE,
  endPortalSession
} from '@/lib/portal-activity';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  const supabase = createSupabaseRouteClient(request, response);
  const { data } = await supabase.auth.getUser();
  const activitySessionId = request.cookies.get(PORTAL_ACTIVITY_SESSION_COOKIE)?.value;
  const reason = request.nextUrl.searchParams.get('reason') === 'expired' ? 'expired' : 'logout';

  if (data.user && activitySessionId) {
    await endPortalSession(activitySessionId, data.user.id, reason);
  }

  await supabase.auth.signOut();
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(PORTAL_ACTIVITY_SESSION_COOKIE);
  return response;
}
