import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!value) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL.');
  return value;
};

const getServiceRoleKey = () => {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY.');
  return value;
};

// Cliente con permisos completos (service role): para escribir en la
// tabla beats y subir archivos a Storage desde acciones del panel.
export const createSupabaseAdminClient = () =>
  createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false }
  });
