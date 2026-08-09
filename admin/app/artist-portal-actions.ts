'use server';

import { revalidatePath } from 'next/cache';
import { requireActiveArtist } from '@/lib/auth';
import { commitFiles, readFile, readJson } from '@/lib/github';
import {
  buildArtistFiles,
  type ArtistData,
  type ArtistReleaseHistory,
  type CasaCatalogConfig,
  type VisionCatalogEntry
} from '@/lib/artist-renderer';
import { SOCIAL_KEYS, parseSocialOrder } from '@/lib/socials';

type ReleaseHistory = { releases: VisionCatalogEntry[] };

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

export const saveOwnArtistPortalAction = async (formData: FormData) => {
  const access = await requireActiveArtist();
  const artistSlug = access.artistSlug;
  if (!artistSlug) throw new Error('Este acceso no esta vinculado a un artista.');

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

  const links: Record<string, string> = {};
  SOCIAL_KEYS.forEach(key => {
    const value = validHttpUrl(formData.get(key), key);
    if (value) links[key] = value;
  });
  artist.links = links;
  artist.socialOrder = parseSocialOrder(formData.get('socialOrder'));

  if (artist.release) {
    const releaseLink = validHttpUrl(formData.get('releaseLink'), 'El enlace de la cancion actual', true);
    artist.release = { ...artist.release, link: releaseLink };

    const releases = artistReleaseHistory.artists[artistSlug] || [];
    const releaseIndex = releases.findIndex(item =>
      artist.release?.slug ? item.slug === artist.release.slug : item.title === artist.release?.title
    );
    if (releaseIndex >= 0) releases[releaseIndex] = { ...releases[releaseIndex], link: releaseLink };
    else releases.push(artist.release);
    artistReleaseHistory.artists[artistSlug] = releases;
  }

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

  revalidatePath('/mi-perfil');
  revalidatePath('/');
};
