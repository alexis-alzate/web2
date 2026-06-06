'use client';

import { createBrowserClient } from '@supabase/ssr';

export const createSupabaseBrowserClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) throw new Error('Faltan variables publicas de Supabase.');

  return createBrowserClient(url, key);
};
