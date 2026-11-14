'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveArtist } from '@/lib/auth';
import type { Artist } from '@/lib/artist-renderer';
import { SOCIAL_KEYS, parseSocialOrder, resolveHeroButtons } from '@/lib/socials';
import { artistService, applyPortalInput, type PortalInput } from '@/lib/artists';
import { readUploadedImage } from '@/lib/artists/images';
import { safeAction } from '@/lib/actions/safe-action';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { readTestArtist, TEST_ARTIST_SLUG } from '@/lib/test-artist';
import { recordCurrentPortalActivity } from '@/lib/portal-activity';

const normalizedRecord = (value: Record<string, string> | undefined) =>
  Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right));

const portalChanges = (before: Artist, after: Artist) => {
  const changes: Array<{ key: string; label: string }> = [];
  if (JSON.stringify(normalizedRecord(before.links)) !== JSON.stringify(normalizedRecord(after.links))) {
    changes.push({ key: 'social_links', label: 'redes y plataformas' });
  }
  if (JSON.stringify(before.heroButtons || {}) !== JSON.stringify(after.heroButtons || {})) {
    changes.push({ key: 'hero_buttons', label: 'botones destacados' });
  }
  if (JSON.stringify(before.socialOrder || []) !== JSON.stringify(after.socialOrder || [])) {
    changes.push({ key: 'social_order', label: 'orden de las redes' });
  }
  if ((before.release?.slug || '') !== (after.release?.slug || '')) {
    changes.push({ key: 'new_release', label: `lanzamiento nuevo (${after.release?.title || ''})` });
  } else if ((before.release?.link || '') !== (after.release?.link || '')) {
    changes.push({ key: 'release_link', label: 'enlace del lanzamiento' });
  }
  if ((before.photo || '') !== (after.photo || '')) {
    changes.push({ key: 'photo', label: 'foto de perfil' });
  }
  return changes;
};

const recordProfileUpdate = async (userId: string, before: Artist, after: Artist) => {
  const changes = portalChanges(before, after);
  await recordCurrentPortalActivity({
    userId,
    eventType: 'profile_updated',
    eventLabel: changes.length
      ? `Actualizó ${changes.map(change => change.label).join(', ')}`
      : 'Guardó su perfil sin cambios visibles',
    metadata: { sections: changes.map(change => change.key) }
  });
};

// La accion solo LEE el formulario. Las reglas (links validos, botones
// distintos, etc.) y el guardado viven en lib/artists/service.ts.
//
// El portal tiene varios formularios pequenos (enlaces, foto, musica nueva).
// Cada uno manda solo sus campos; lo que un formulario NO manda se toma del
// perfil actual, asi guardar la foto no toca los enlaces y viceversa.
const readPortalForm = async (formData: FormData, current: Artist): Promise<PortalInput> => {
  const newTitle = String(formData.get('newReleaseTitle') || '').trim();
  const newLink = String(formData.get('newReleaseLink') || '').trim();
  const newCover = await readUploadedImage(formData, 'newReleaseCover');
  const sendsLinks = SOCIAL_KEYS.some(key => formData.has(key));
  const currentHero = resolveHeroButtons(current.links, current.heroButtons);

  return {
    links: sendsLinks
      ? Object.fromEntries(SOCIAL_KEYS.map(key => [key, String(formData.get(key) || '').trim()]))
      : { ...(current.links ?? {}) },
    socialOrder: formData.has('socialOrder') ? parseSocialOrder(formData.get('socialOrder')) : current.socialOrder ?? [],
    heroPrimary: formData.has('heroPrimary') ? String(formData.get('heroPrimary') || '') : currentHero.primary || '',
    heroSecondary: formData.has('heroSecondary') ? String(formData.get('heroSecondary') || '') : currentHero.secondary || '',
    releaseLink: formData.has('releaseLink') ? String(formData.get('releaseLink') || '') : current.release?.link || '',
    uploadedPhoto: await readUploadedImage(formData, 'photoFile'),
    // Basta con que llene uno de los tres campos para tratarlo como un
    // lanzamiento nuevo; el servicio le dice cual le falta.
    newRelease: newTitle || newLink || newCover
      ? { title: newTitle, link: newLink, uploadedCover: newCover }
      : null
  };
};

const requireOwnArtistSlug = async () => {
  const access = await requireActiveArtist();
  if (!access.artistSlug) throw new ForbiddenError('Este acceso no esta vinculado a un artista.');
  return { access, artistSlug: access.artistSlug };
};

// El layout del portal muestra nombre y foto: se revalida todo el arbol.
const revalidatePortal = () => {
  revalidatePath('/mi-perfil', 'layout');
  revalidatePath('/');
};

export const saveOwnArtistPortalAction = safeAction(async (formData: FormData) => {
  const { access, artistSlug } = await requireOwnArtistSlug();

  if (artistSlug === TEST_ARTIST_SLUG) {
    // La cuenta de prueba no existe en la tabla de artistas: su perfil vive
    // en los metadatos del usuario y nunca publica nada. Las imagenes se
    // validan pero no se guardan en ninguna parte.
    const before = readTestArtist(access.user.app_metadata?.lujo_test_profile);
    const after = applyPortalInput(before, await readPortalForm(formData, before));
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(access.user.id, {
      app_metadata: {
        ...(access.user.app_metadata || {}),
        lujo_test_profile: after
      }
    });
    if (error) throw new Error(`No pude guardar la prueba: ${error.message}`);

    await recordProfileUpdate(access.user.id, before, after);

    revalidatePath('/mi-perfil', 'layout');
    return;
  }

  const current = (await artistService.findArtistBySlug(artistSlug))?.artist;
  if (!current) throw new ForbiddenError('Tu cuenta ya no esta vinculada a un perfil publicado.');

  const { before, after } = await artistService.savePortalProfile(artistSlug, await readPortalForm(formData, current));
  await recordProfileUpdate(access.user.id, before, after);

  revalidatePortal();
});

// --- Mi música: corregir, volver principal o borrar una cancion ya publicada.
// El slug de la cancion viene del formulario, pero el del ARTISTA sale siempre
// de la sesion: nadie puede tocar la musica de otro.

const requireRealArtistForMusic = async () => {
  const context = await requireOwnArtistSlug();
  if (context.artistSlug === TEST_ARTIST_SLUG) {
    throw new ValidationError('La cuenta de prueba no guarda canciones anteriores. Esto solo funciona en un perfil real.');
  }
  return context;
};

const releaseSlugOf = (formData: FormData) => {
  const slug = String(formData.get('releaseSlug') || '').trim();
  if (!slug) throw new ValidationError('No sabemos qué canción quieres cambiar. Recarga la página.');
  return slug;
};

const recordMusicActivity = (userId: string, section: string, label: string) =>
  recordCurrentPortalActivity({
    userId,
    eventType: 'profile_updated',
    eventLabel: label,
    metadata: { sections: [section] }
  });

export const updateOwnReleaseAction = safeAction(async (formData: FormData) => {
  const { access, artistSlug } = await requireRealArtistForMusic();

  const { title } = await artistService.updatePortalRelease(artistSlug, releaseSlugOf(formData), {
    title: String(formData.get('title') || ''),
    link: String(formData.get('link') || ''),
    uploadedCover: await readUploadedImage(formData, 'cover')
  });
  await recordMusicActivity(access.user.id, 'release_edited', `Corrigió la canción ${title}`);

  revalidatePortal();
});

export const promoteOwnReleaseAction = safeAction(async (formData: FormData) => {
  const { access, artistSlug } = await requireRealArtistForMusic();

  const { title } = await artistService.promotePortalRelease(artistSlug, releaseSlugOf(formData));
  await recordMusicActivity(access.user.id, 'release_promoted', `Puso ${title} como canción principal`);

  revalidatePortal();
});

export const deleteOwnReleaseAction = safeAction(async (formData: FormData) => {
  const { access, artistSlug } = await requireRealArtistForMusic();
  if (String(formData.get('confirm') || '') !== 'si') {
    throw new ValidationError('Marca la casilla para confirmar que quieres borrar la canción.');
  }

  const { title } = await artistService.deletePortalRelease(artistSlug, releaseSlugOf(formData));
  await recordMusicActivity(access.user.id, 'release_deleted', `Borró la canción ${title}`);

  revalidatePortal();
});
