import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  const supabase = createSupabaseRouteClient(request, response);
  await supabase.auth.signOut();
  return response;
}
