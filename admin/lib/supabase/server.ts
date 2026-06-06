import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const getSupabaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL.');
  return value;
};

const getSupabaseKey = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new Error('Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  return value;
};

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; Route Handlers and Server Actions can.
        }
      }
    }
  });
};
