import type { User } from '@supabase/supabase-js';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type LujoRole = 'admin' | 'artist' | 'producer';
export type LujoAccessStatus = 'active' | 'suspended' | 'inactive';

export type LujoAccess = {
  user: User;
  role: LujoRole | null;
  status: LujoAccessStatus;
  artistSlug: string | null;
  producerId: string | null;
};

const isRole = (value: unknown): value is LujoRole =>
  value === 'admin' || value === 'artist' || value === 'producer';

export const isAccessStatus = (value: unknown): value is LujoAccessStatus =>
  value === 'active' || value === 'suspended' || value === 'inactive';

export const readAccessMetadata = (user: User): LujoAccess => {
  const metadata = user.app_metadata || {};
  const role = isRole(metadata.lujo_role) ? metadata.lujo_role : null;
  const status = isAccessStatus(metadata.lujo_access) ? metadata.lujo_access : 'inactive';
  const artistSlug = role === 'artist' && typeof metadata.lujo_artist_slug === 'string'
    ? metadata.lujo_artist_slug.trim() || null
    : null;

  const producerId = role === 'producer' && typeof metadata.lujo_producer_id === 'string'
    ? metadata.lujo_producer_id.trim() || null
    : null;

  return { user, role, status, artistSlug, producerId };
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
  if (!access) throw new UnauthorizedError();
  if (access.role !== 'admin' || access.status !== 'active') {
    throw new ForbiddenError();
  }
  return access;
};

export const requireActiveArtist = async () => {
  const access = await getCurrentAccess();
  if (!access) throw new UnauthorizedError();
  if (access.role !== 'artist' || !access.artistSlug) {
    throw new ForbiddenError('Este acceso no esta vinculado a un artista.');
  }
  if (access.status !== 'active') {
    throw new ForbiddenError('Tu acceso de artista no esta activo. Contacta a Lujo Urban.');
  }
  return access;
};

export const requireActiveProducer = async () => {
  const access = await getCurrentAccess();
  if (!access) throw new UnauthorizedError();
  if (access.role !== 'producer' || !access.producerId) {
    throw new ForbiddenError('Este acceso no esta vinculado a un productor.');
  }
  if (access.status !== 'active') {
    throw new ForbiddenError('Tu acceso de productor no esta activo. Contacta a Lujo Urban.');
  }
  return access as typeof access & { producerId: string };
};
