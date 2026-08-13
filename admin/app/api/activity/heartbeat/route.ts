import { NextRequest, NextResponse } from 'next/server';
import {
  PORTAL_ACTIVITY_SESSION_COOKIE,
  touchPortalSession
} from '@/lib/portal-activity';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const sessionId = request.cookies.get(PORTAL_ACTIVITY_SESSION_COOKIE)?.value;
  if (!sessionId) return response;

  const supabase = createSupabaseRouteClient(request, response);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await touchPortalSession(sessionId, data.user.id);
  return response;
}
