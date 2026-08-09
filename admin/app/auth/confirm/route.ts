import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/server';

const allowedTypes = new Set<EmailOtpType>(['invite', 'recovery', 'signup', 'email']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const requestedType = url.searchParams.get('type') as EmailOtpType | null;
  const requestedNext = url.searchParams.get('next') || '/';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/';

  if (!tokenHash || !requestedType || !allowedTypes.has(requestedType)) {
    return NextResponse.redirect(new URL('/login?error=auth', request.url));
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createSupabaseRouteClient(request, response);
  const { error } = await supabase.auth.verifyOtp({
    type: requestedType,
    token_hash: tokenHash
  });

  if (!error) return response;
  return NextResponse.redirect(new URL('/login?error=auth', request.url));
}
