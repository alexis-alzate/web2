'use server';

import { revalidatePath } from 'next/cache';
import { getAppOrigin } from '@/lib/app-origin';
import { sendArtistInviteEmail } from '@/lib/artist-invite-email';
import { isAccessStatus, requireAdmin, type LujoAccessStatus } from '@/lib/auth';
import { readJson } from '@/lib/github';
import type { ArtistData } from '@/lib/artist-renderer';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { createTestArtist, TEST_ARTIST_SLUG } from '@/lib/test-artist';
import type { User } from '@supabase/supabase-js';

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
) => {
  const next = { ...current };
  delete next.lujo_unlinked_at;
  if (artistSlug !== TEST_ARTIST_SLUG) delete next.lujo_test_profile;
  return {
    ...next,
    lujo_role: 'artist',
    lujo_artist_slug: artistSlug,
    lujo_access: status
  };
};

const unlinkedMetadata = (current: Record<string, unknown>) => {
  const next = { ...current };
  delete next.lujo_test_profile;
  return {
    ...next,
    lujo_role: 'artist',
    lujo_artist_slug: null,
    lujo_access: 'inactive',
    lujo_unlinked_at: new Date().toISOString()
  };
};

const listUsers = async (supabase: ReturnType<typeof createSupabaseAdminClient>) => {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`No pude revisar los accesos existentes: ${error.message}`);
  return data.users;
};

const listArtistUsers = async (supabase: ReturnType<typeof createSupabaseAdminClient>) =>
  (await listUsers(supabase)).filter(user => user.app_metadata?.lujo_role === 'artist');

const linkedSlug = (user: User) => typeof user.app_metadata?.lujo_artist_slug === 'string'
  ? user.app_metadata.lujo_artist_slug.trim()
  : '';

const ensureSlotAvailable = (users: User[], artistSlug: string, excludeUserId?: string) => {
  const linked = users.find(user => user.id !== excludeUserId && linkedSlug(user) === artistSlug);
  if (linked) {
    const label = artistSlug === TEST_ARTIST_SLUG ? 'La cuenta de prueba' : 'Este artista';
    throw new Error(`${label} ya tiene un correo vinculado (${linked.email || 'sin correo'}). Desvincúlalo antes de asignar otro.`);
  }
};

const inviteOrRelinkUser = async ({
  email,
  artistSlug,
  artistName
}: {
  email: string;
  artistSlug: string;
  artistName: string;
}) => {
  const supabase = createSupabaseAdminClient();
  const allUsers = await listUsers(supabase);
  const artistUsers = allUsers.filter(user => user.app_metadata?.lujo_role === 'artist');
  ensureSlotAvailable(artistUsers, artistSlug);

  const existing = allUsers.find(user => user.email?.toLowerCase() === email);
  if (existing) {
    if (existing.app_metadata?.lujo_role !== 'artist') {
      throw new Error('Ese correo ya pertenece a otra clase de acceso del panel. Usa un correo diferente.');
    }
    if (linkedSlug(existing)) {
      throw new Error('Ese correo ya está vinculado a otro perfil. Desvincúlalo primero.');
    }
    if (!existing.email_confirmed_at) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(existing.id);
      if (deleteError) {
        throw new Error('Ese correo tiene una invitación anterior sin confirmar y no pude renovarla. Intenta otra vez.');
      }
    } else {
      const previousMetadata = existing.app_metadata || {};
      const metadata = artistMetadata(previousMetadata, artistSlug, 'active');
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        app_metadata: artistSlug === TEST_ARTIST_SLUG
          ? { ...metadata, lujo_test_profile: createTestArtist() }
          : metadata
      });
      if (error) throw new Error(`No pude volver a vincular ese correo: ${error.message}`);

      const verificationUsers = await listArtistUsers(supabase);
      const collisions = verificationUsers.filter(user => linkedSlug(user) === artistSlug);
      if (collisions.length > 1) {
        await supabase.auth.admin.updateUserById(existing.id, { app_metadata: previousMetadata });
        throw new Error('Otro acceso ocupó este perfil al mismo tiempo. El correo anterior quedó sin vincular.');
      }
      return;
    }
  }

  const origin = await getAppOrigin();
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Falta configurar RESEND_API_KEY para enviar invitaciones de artistas.');
  }

  const { data, error } = await supabase.auth.admin.generateLink({ type: 'invite', email });
  if (error || !data.user) throw new Error(error?.message || 'No pude crear la invitación.');
  const invitedUser = data.user;
  const inviteUrl = new URL('/auth/confirm', origin);
  inviteUrl.searchParams.set('token_hash', data.properties.hashed_token);
  inviteUrl.searchParams.set('type', 'invite');
  inviteUrl.searchParams.set('next', '/reset-password');

  const metadata = artistMetadata(invitedUser.app_metadata || {}, artistSlug, 'active');
  const { error: metadataError } = await supabase.auth.admin.updateUserById(invitedUser.id, {
    app_metadata: artistSlug === TEST_ARTIST_SLUG
      ? { ...metadata, lujo_test_profile: createTestArtist() }
      : metadata
  });

  if (metadataError) {
    await supabase.auth.admin.deleteUser(invitedUser.id).catch(() => null);
    throw new Error('La invitación no pudo vincularse. Intenta otra vez.');
  }

  const verificationUsers = await listArtistUsers(supabase);
  const collisions = verificationUsers.filter(user => linkedSlug(user) === artistSlug);
  if (collisions.length > 1) {
    await supabase.auth.admin.deleteUser(invitedUser.id).catch(() => null);
    throw new Error('Otro acceso ocupó este perfil al mismo tiempo. No se creó una cuenta duplicada.');
  }

  try {
    await sendArtistInviteEmail(email, artistName, inviteUrl.toString());
  } catch (sendError) {
    await supabase.auth.admin.deleteUser(invitedUser.id).catch(() => null);
    throw sendError;
  }
};

export const inviteArtistUserAction = async (formData: FormData) => {
  await requireAdmin();

  const email = requiredText(formData, 'email', 'El correo').toLowerCase();
  const artistSlug = requiredText(formData, 'artistSlug', 'El artista');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('El correo no es válido.');
  const artist = await ensureArtistExists(artistSlug);

  await inviteOrRelinkUser({ email, artistSlug, artistName: artist.cardName || artist.name });

  revalidatePath('/');
};

export const createTestArtistUserAction = async (formData: FormData) => {
  await requireAdmin();
  const email = requiredText(formData, 'email', 'El correo de prueba').toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('El correo de prueba no es válido.');

  await inviteOrRelinkUser({
    email,
    artistSlug: TEST_ARTIST_SLUG,
    artistName: 'Cuenta de prueba'
  });
  revalidatePath('/');
};

export const updateArtistUserAccessAction = async (formData: FormData) => {
  await requireAdmin();

  const userId = requiredText(formData, 'userId', 'El usuario');
  const requestedStatus = requiredText(formData, 'accessStatus', 'El estado');
  if (!isAccessStatus(requestedStatus)) throw new Error('El estado no es válido.');

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error('No encontré esa cuenta.');
  if (data.user.app_metadata?.lujo_role !== 'artist') {
    throw new Error('Por seguridad, esta acción solo modifica cuentas de artistas.');
  }
  const artistSlug = linkedSlug(data.user);
  if (!artistSlug) throw new Error('Esta cuenta ya está desvinculada.');

  if (requestedStatus !== 'inactive') {
    const users = await listArtistUsers(supabase);
    ensureSlotAvailable(users, artistSlug, userId);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: artistMetadata(data.user.app_metadata || {}, artistSlug, requestedStatus)
  });
  if (updateError) throw new Error(`No pude actualizar el acceso: ${updateError.message}`);

  revalidatePath('/');
};

export const unlinkArtistUserAction = async (formData: FormData) => {
  await requireAdmin();
  const userId = requiredText(formData, 'userId', 'El usuario');
  const confirmation = requiredText(formData, 'confirmation', 'La confirmación');
  if (confirmation !== 'DESVINCULAR') {
    throw new Error('Escribe DESVINCULAR para confirmar el cambio de correo.');
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error('No encontré esa cuenta.');
  if (data.user.app_metadata?.lujo_role !== 'artist') {
    throw new Error('Por seguridad, esta acción solo modifica cuentas de artistas.');
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: unlinkedMetadata(data.user.app_metadata || {})
  });
  if (updateError) throw new Error(`No pude desvincular el correo: ${updateError.message}`);
  revalidatePath('/');
};

export const convertArtistUserToTestAction = async (formData: FormData) => {
  await requireAdmin();
  const userId = requiredText(formData, 'userId', 'El usuario');
  const supabase = createSupabaseAdminClient();
  const users = await listArtistUsers(supabase);
  ensureSlotAvailable(users, TEST_ARTIST_SLUG, userId);

  const user = users.find(item => item.id === userId);
  if (!user) throw new Error('No encontré esa cuenta.');
  if (user.app_metadata?.lujo_access !== 'inactive') {
    throw new Error('Primero coloca esta cuenta en Inactivo antes de convertirla en la cuenta de prueba.');
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...artistMetadata(user.app_metadata || {}, TEST_ARTIST_SLUG, 'active'),
      lujo_test_profile: createTestArtist()
    }
  });
  if (error) throw new Error(`No pude crear la cuenta de prueba: ${error.message}`);
  revalidatePath('/');
};
