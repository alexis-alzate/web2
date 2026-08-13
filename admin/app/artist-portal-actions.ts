'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveArtist } from '@/lib/auth';
import { commitFiles, readFile, readJson } from '@/lib/github';
import {
  buildArtistFiles,
  type Artist,
  type ArtistData,
  type ArtistReleaseHistory,
  type CasaCatalogConfig,
  type VisionCatalogEntry
} from '@/lib/artist-renderer';
import { SOCIAL_KEYS, SOCIAL_LABELS, isSocialKey, parseSocialOrder, type SocialKey } from '@/lib/socials';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { readTestArtist, TEST_ARTIST_SLUG } from '@/lib/test-artist';
import { recordCurrentPortalActivity } from '@/lib/portal-activity';

type ReleaseHistory = { releases: VisionCatalogEntry[] };

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

const validHttpUrl = (value: FormDataEntryValue | null, label: string, required = false) => {
  const text = String(value || '').trim();
  if (!text) {
    if (required) throw new Error(`${label} es obligatorio.`);
    return '';
  }

  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
  } catch {
    throw new Error(`${label} debe ser un enlace completo que empiece por https://.`);
  }
  return text;
};

const optionalSocialKey = (value: FormDataEntryValue | null, label: string): SocialKey | undefined => {
  const key = String(value || '').trim();
  if (!key) return undefined;
  if (!isSocialKey(key)) throw new Error(`${label} no es una red válida.`);
  return key;
};

const applyArtistPortalForm = (
  artist: Artist,
  formData: FormData,
  onReleaseLink?: (releaseLink: string) => void
) => {
  const links: Record<string, string> = {};
  SOCIAL_KEYS.forEach(key => {
    const value = validHttpUrl(formData.get(key), key);
    if (value) links[key] = value;
  });
  artist.links = links;
  artist.socialOrder = parseSocialOrder(formData.get('socialOrder'));

  const primary = optionalSocialKey(formData.get('heroPrimary'), 'El botón principal');
  const secondary = optionalSocialKey(formData.get('heroSecondary'), 'El botón secundario');
  if (primary && !links[primary]) {
    throw new Error(`Agrega primero tu enlace de ${SOCIAL_LABELS[primary]} para usarlo en el botón principal.`);
  }
  if (secondary && !links[secondary]) {
    throw new Error(`Agrega primero tu enlace de ${SOCIAL_LABELS[secondary]} para usarlo en el botón secundario.`);
  }
  if (primary && secondary && primary === secondary) {
    throw new Error('Elige dos redes diferentes para los botones superiores.');
  }
  artist.heroButtons = primary || secondary ? { primary, secondary } : undefined;

  if (artist.release) {
    const releaseLink = validHttpUrl(formData.get('releaseLink'), 'El enlace de la canción actual', true);
    artist.release = { ...artist.release, link: releaseLink };
    onReleaseLink?.(releaseLink);
  }

  return artist;
};

export const saveOwnArtistPortalAction = async (formData: FormData) => {
  const access = await requireActiveArtist();
  const artistSlug = access.artistSlug;
  if (!artistSlug) throw new Error('Este acceso no esta vinculado a un artista.');

  if (artistSlug === TEST_ARTIST_SLUG) {
    const artist = readTestArtist(access.user.app_metadata?.lujo_test_profile);
    const before = JSON.parse(JSON.stringify(artist)) as Artist;
    applyArtistPortalForm(artist, formData);
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(access.user.id, {
      app_metadata: {
        ...(access.user.app_metadata || {}),
        lujo_test_profile: artist
      }
    });
    if (error) throw new Error(`No pude guardar la prueba: ${error.message}`);

    await recordProfileUpdate(access.user.id, before, artist);

    revalidatePath('/mi-perfil');
    return;
  }

  const [data, sitemap, visionSource, releaseHistory, artistReleaseHistory, catalog] = await Promise.all([
    readJson<ArtistData>('artist-data.json', { artists: [] }),
    readFile('sitemap.xml'),
    readFile('lujourban-vision/index.html'),
    readJson<ReleaseHistory>('release-history.json', { releases: [] }),
    readJson<ArtistReleaseHistory>('artist-release-history.json', { artists: {} }),
    readJson<CasaCatalogConfig>('casa-catalog.json', { picks: [] })
  ]);

  const artist = data.artists.find(item => item.slug === artistSlug);
  if (!artist) throw new Error('Tu cuenta ya no esta vinculada a un perfil publicado.');
  const before = JSON.parse(JSON.stringify(artist)) as Artist;

  applyArtistPortalForm(artist, formData, releaseLink => {
    if (artist.release) {
      const releases = artistReleaseHistory.artists[artistSlug] || [];
      const releaseIndex = releases.findIndex(item =>
        artist.release?.slug ? item.slug === artist.release.slug : item.title === artist.release?.title
      );
      if (releaseIndex >= 0) releases[releaseIndex] = { ...releases[releaseIndex], link: releaseLink };
      else releases.push(artist.release);
      artistReleaseHistory.artists[artistSlug] = releases;
    }
  });

  await commitFiles([
    ...buildArtistFiles(data, sitemap, {
      source: visionSource,
      releases: releaseHistory.releases,
      artistReleases: artistReleaseHistory.artists,
      catalog
    }),
    {
      path: 'artist-release-history.json',
      content: `${JSON.stringify(artistReleaseHistory, null, 2)}\n`
    }
  ], `Update artist links for ${artist.name}`);

  await recordProfileUpdate(access.user.id, before, artist);

  revalidatePath('/mi-perfil');
  revalidatePath('/');
};
