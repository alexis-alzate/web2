import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type LujoRole = 'admin' | 'artist';
export type LujoAccessStatus = 'active' | 'suspended' | 'inactive';

export type LujoAccess = {
  user: User;
  role: LujoRole | null;
  status: LujoAccessStatus;
  artistSlug: string | null;
};

const isRole = (value: unknown): value is LujoRole =>
  value === 'admin' || value === 'artist';

export const isAccessStatus = (value: unknown): value is LujoAccessStatus =>
  value === 'active' || value === 'suspended' || value === 'inactive';

export const readAccessMetadata = (user: User): LujoAccess => {
  const metadata = user.app_metadata || {};
  const role = isRole(metadata.lujo_role) ? metadata.lujo_role : null;
  const status = isAccessStatus(metadata.lujo_access) ? metadata.lujo_access : 'inactive';
  const artistSlug = role === 'artist' && typeof metadata.lujo_artist_slug === 'string'
    ? metadata.lujo_artist_slug.trim() || null
    : null;

  return { user, role, status, artistSlug };
};

export const getCurrentAccess = async (): Promise<LujoAccess | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return readAccessMetadata(data.user);
  } catch {
    return null;
  }
};

export const isAuthenticated = async () => Boolean(await getCurrentAccess());

export const requireAdmin = async () => {
  const access = await getCurrentAccess();
  if (!access) throw new Error('Tu sesion expiro. Inicia de nuevo.');
  if (access.role !== 'admin' || access.status !== 'active') {
    throw new Error('No tienes permiso para realizar esta accion.');
  }
  return access;
};

export const requireActiveArtist = async () => {
  const access = await getCurrentAccess();
  if (!access) throw new Error('Tu sesion expiro. Inicia de nuevo.');
  if (access.role !== 'artist' || !access.artistSlug) {
    throw new Error('Este acceso no esta vinculado a un artista.');
  }
  if (access.status !== 'active') {
    throw new Error('Tu acceso de artista no esta activo. Contacta a Lujo Urban.');
  }
  return access;
};
