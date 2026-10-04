'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveArtist } from '@/lib/auth';
import type { Artist } from '@/lib/artist-renderer';
import { SOCIAL_KEYS, parseSocialOrder } from '@/lib/socials';
import { artistService, applyPortalInput, type PortalInput } from '@/lib/artists';
import { safeAction } from '@/lib/actions/safe-action';
import { ForbiddenError } from '@/lib/errors';
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
  if ((before.release?.link || '') !== (after.release?.link || '')) {
    changes.push({ key: 'release_link', label: 'enlace del lanzamiento' });
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
const readPortalForm = (formData: FormData): PortalInput => ({
  links: Object.fromEntries(SOCIAL_KEYS.map(key => [key, String(formData.get(key) || '').trim()])),
  socialOrder: parseSocialOrder(formData.get('socialOrder')),
  heroPrimary: String(formData.get('heroPrimary') || ''),
  heroSecondary: String(formData.get('heroSecondary') || ''),
  releaseLink: String(formData.get('releaseLink') || '')
});

export const saveOwnArtistPortalAction = safeAction(async (formData: FormData) => {
  const access = await requireActiveArtist();
  const artistSlug = access.artistSlug;
  if (!artistSlug) throw new ForbiddenError('Este acceso no esta vinculado a un artista.');

  const input = readPortalForm(formData);

  if (artistSlug === TEST_ARTIST_SLUG) {
    // La cuenta de prueba no existe en la tabla de artistas: su perfil vive
    // en los metadatos del usuario y nunca publica nada.
    const before = readTestArtist(access.user.app_metadata?.lujo_test_profile);
    const after = applyPortalInput(before, input);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(access.user.id, {
      app_metadata: {
        ...(access.user.app_metadata || {}),
        lujo_test_profile: after
      }
    });
    if (error) throw new Error(`No pude guardar la prueba: ${error.message}`);

    await recordProfileUpdate(access.user.id, before, after);

    revalidatePath('/mi-perfil');
    return;
  }

  const { before, after } = await artistService.savePortalProfile(artistSlug, input);
  await recordProfileUpdate(access.user.id, before, after);

  revalidatePath('/mi-perfil');
  revalidatePath('/');
});
