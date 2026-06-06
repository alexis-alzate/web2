import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

const getSupabaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!value) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL.');
  return value;
};

const getSupabaseKey = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY;
  if (!value) throw new Error('Falta la llave publica de Supabase.');
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

export const createSupabaseRouteClient = (request: Request, response: NextResponse) =>
  createServerClient(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return request.headers.get('cookie')?.split(';').map(cookie => {
          const [name, ...rest] = cookie.trim().split('=');
          return { name, value: rest.join('=') };
        }).filter(cookie => cookie.name) || [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });
