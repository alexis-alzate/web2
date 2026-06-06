import { createSupabaseServerClient } from '@/lib/supabase/server';

export const isAuthenticated = async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return true;

  const { data: sessionData } = await supabase.auth.getSession();
  return Boolean(sessionData.session?.user);
};
