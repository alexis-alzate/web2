import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL.');
  return value;
};

const getSupabaseAnonKey = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) throw new Error('Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  return value;
};

const getSupabaseServiceRoleKey = () => {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY.');
  return value;
};

// Cliente para Server Components / lecturas publicas (catalogo)
export const createSupabaseServerClient = () =>
  createClient(getSupabaseUrl(), getSupabaseAnonKey());

// Cliente con permisos completos para Route Handlers (checkout, webhook)
export const createSupabaseAdminClient = () =>
  createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false }
  });
