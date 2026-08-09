'use server';

import { revalidatePath } from 'next/cache';
import { getAppOrigin } from '@/lib/app-origin';
import { sendArtistInviteEmail } from '@/lib/artist-invite-email';
import { isAccessStatus, requireAdmin, type LujoAccessStatus } from '@/lib/auth';
import { readJson } from '@/lib/github';
import type { ArtistData } from '@/lib/artist-renderer';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';

const requiredText = (formData: FormData, field: string, label: string) => {
  const value = String(formData.get(field) || '').trim();
  if (!value) throw new Error(`${label} es obligatorio.`);
  return value;
};

const ensureArtistExists = async (artistSlug: string) => {
  const data = await readJson<ArtistData>('artist-data.json', { artists: [] });
  const artist = data.artists.find(item => item.slug === artistSlug);
  if (!artist) {
    throw new Error('No encontre ese artista en el roster.');
  }
  return artist;
};

const artistMetadata = (
  current: Record<string, unknown>,
  artistSlug: string,
  status: LujoAccessStatus
) => ({
  ...current,
  lujo_role: 'artist',
  lujo_artist_slug: artistSlug,
  lujo_access: status
});

export const inviteArtistUserAction = async (formData: FormData) => {
  await requireAdmin();

  const email = requiredText(formData, 'email', 'El correo').toLowerCase();
  const artistSlug = requiredText(formData, 'artistSlug', 'El artista');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('El correo no es valido.');
  const artist = await ensureArtistExists(artistSlug);

  const supabase = createSupabaseAdminClient();
  const origin = await getAppOrigin();
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Falta configurar RESEND_API_KEY para enviar invitaciones de artistas.');
  }

  const { data, error } = await supabase.auth.admin.generateLink({ type: 'invite', email });
  if (error || !data.user) throw new Error(error?.message || 'No pude crear la invitacion.');
  const invitedUser = data.user;
  const inviteUrl = new URL('/auth/confirm', origin);
  inviteUrl.searchParams.set('token_hash', data.properties.hashed_token);
  inviteUrl.searchParams.set('type', 'invite');
  inviteUrl.searchParams.set('next', '/reset-password');

  const { error: metadataError } = await supabase.auth.admin.updateUserById(invitedUser.id, {
    app_metadata: artistMetadata(invitedUser.app_metadata || {}, artistSlug, 'active')
  });

  if (metadataError) {
    await supabase.auth.admin.deleteUser(invitedUser.id).catch(() => null);
    throw new Error('La invitacion no pudo vincularse al artista. Intenta otra vez.');
  }

  try {
    await sendArtistInviteEmail(email, artist.cardName || artist.name, inviteUrl.toString());
  } catch (error) {
    await supabase.auth.admin.deleteUser(invitedUser.id).catch(() => null);
    throw error;
  }

  revalidatePath('/');
};

export const updateArtistUserAccessAction = async (formData: FormData) => {
  await requireAdmin();

  const userId = requiredText(formData, 'userId', 'El usuario');
  const artistSlug = requiredText(formData, 'artistSlug', 'El artista');
  const requestedStatus = requiredText(formData, 'accessStatus', 'El estado');
  if (!isAccessStatus(requestedStatus)) throw new Error('El estado no es valido.');
  await ensureArtistExists(artistSlug);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error('No encontre esa cuenta.');
  if (data.user.app_metadata?.lujo_role !== 'artist') {
    throw new Error('Por seguridad, esta accion solo modifica cuentas de artistas.');
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: artistMetadata(data.user.app_metadata || {}, artistSlug, requestedStatus)
  });
  if (updateError) throw new Error(`No pude actualizar el acceso: ${updateError.message}`);

  revalidatePath('/');
};
