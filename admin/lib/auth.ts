import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

type SupabaseCookieSession = {
  expires_at?: number;
  user?: unknown;
};

const decodeSupabaseCookie = (value: string) => {
  try {
    const raw = value.startsWith('base64-')
      ? Buffer.from(value.slice('base64-'.length), 'base64').toString('utf8')
      : decodeURIComponent(value);
    return JSON.parse(raw) as SupabaseCookieSession;
  } catch {
    return null;
  }
};

const hasValidSupabaseSessionCookie = async () => {
  const cookieStore = await cookies();
  const authCookie = cookieStore.getAll().find(cookie =>
    cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')
  );
  if (!authCookie?.value) return false;

  const session = decodeSupabaseCookie(authCookie.value);
  if (!session?.user) return false;
  if (!session.expires_at) return true;

  return session.expires_at * 1000 > Date.now();
};

export const isAuthenticated = async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return true;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return true;

  return hasValidSupabaseSessionCookie();
};
