import { createSupabaseServerClient } from '@/lib/supabase/server';

export const isAuthenticated = async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  return !error && Boolean(data.user);
};
