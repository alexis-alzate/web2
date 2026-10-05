'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/backend/auth/auth';
import { ConflictError, NotFoundError, ValidationError } from '@/backend/core/errors';
import { commitFiles, readFile, readJson } from '@/backend/integrations/github';
import {
  type CasaCatalogConfig,
  type CasaCatalogPick,
  VISION_MAX_CRATE
} from '@/backend/integrations/artist-renderer';
import { SOCIAL_KEYS, parseSocialOrder } from '@/shared/socials';
import { readUploadedImage } from '@/backend/artists/images';
import { artistService } from '@/backend/artists';
import { safeAction } from '@/backend/core/safe-action';

type Release = {
  title: string;
  slug: string;
  cover: string;
  link: string;
  browserTitle: string;
  heroText: string;
  shareUrl: string;
  statusUrl?: string;
};

type ReleaseHistory = {
  releases: Release[];
};

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const escapeHtml = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const replaceRequired = (source: string, pattern: RegExp, replacement: string, label: string) => {
  if (!pattern.test(source)) throw new Error(`No encontre ${label}.`);
  return source.replace(pattern, replacement);
};

const getHighResSpotifyImageUrl = (url: string) => url.replace('0000b273', '00001e02');

const fetchSpotifyCover = async (thumbnailUrl: string) => {
  const urls = Array.from(new Set([
    getHighResSpotifyImageUrl(thumbnailUrl),
    thumbnailUrl
  ]));

  for (const url of urls) {
    const response = await fetch(url);
    if (response.ok) return response;
  }

  throw new Error('No pude descargar la portada desde Spotify.');
};

const normalizeOptional = (value: FormDataEntryValue | null) => {
  const text = String(value || '').trim();
  return text || '';
};

const formLinks = (formData: FormData) =>
  Object.fromEntries(SOCIAL_KEYS.map(key => [key, normalizeOptional(formData.get(key))]));

const rebuildCasaCatalog = async (catalog: CasaCatalogConfig, message: string) => {
  await artistService.publishCasaCatalog(catalog, message);
  revalidatePath('/');
};

const readCasaCatalog = () => readJson<CasaCatalogConfig>('casa-catalog.json', { picks: [] });

const parseCasaCatalogPick = (value: string): CasaCatalogPick | null => {
  const [source, artistSlug, releaseSlug] = String(value || '').split('|');
  if (!releaseSlug) return null;
  if (source === 'artist' && artistSlug) return { source: 'artist', artistSlug, releaseSlug };
  if (source === 'zaetta') return { source: 'zaetta', releaseSlug };
  return null;
};

const samePick = (a: CasaCatalogPick, b: CasaCatalogPick) =>
  a.source === b.source && a.artistSlug === b.artistSlug && a.releaseSlug === b.releaseSlug;

const applyHomeRelease = async (selected: Release) => {
  const [scriptSource, htmlSource] = await Promise.all([
    readFile('script.js'),
    readFile('index.html')
  ]);

  const previousConfig = scriptSource.match(/const latestRelease = \{[\s\S]*?\n\};/);
  if (!previousConfig) throw new Error('No encontre latestRelease en script.js.');

  const previousLink = previousConfig[0].match(/link:\s*['"]([^'"]+)['"]/)?.[1];
  const previousSlug = previousConfig[0].match(/slug:\s*['"]([^'"]+)['"]/)?.[1];
  const previousCover = previousConfig[0].match(/cover:\s*['"]([^'"]+)['"]/)?.[1];
  const previousTitle = previousConfig[0].match(/trackingTitle:\s*['"]([^'"]+)['"]/)?.[1];
  if (!previousLink || !previousSlug || !previousCover || !previousTitle) {
    throw new Error('La configuracion actual del home esta incompleta.');
  }

  const config = `const latestRelease = {
  title: ${JSON.stringify(selected.title)},
  trackingTitle: ${JSON.stringify(selected.title)},
  slug: ${JSON.stringify(selected.slug)},
  artist: 'ZAETTA',
  cover: ${JSON.stringify(selected.cover)},
  link: ${JSON.stringify(selected.link)},
  shareUrl: ${JSON.stringify(selected.shareUrl)},
  browserTitle: ${JSON.stringify(selected.browserTitle)},
  heroText: ${JSON.stringify(selected.heroText)}
};`;

  let nextHtml = htmlSource
    .replaceAll(previousLink, selected.link)
    .replaceAll(previousCover, selected.cover)
    .replaceAll(`release_${previousSlug}`, `release_${selected.slug}`)
    .replaceAll(`data-track-content="${escapeHtml(previousTitle)}"`, `data-track-content="${escapeHtml(selected.title)}"`);

  nextHtml = replaceRequired(nextHtml, /<p class="hero-sub" data-release-hero-text>[^<]*<\/p>/, `<p class="hero-sub" data-release-hero-text>${escapeHtml(selected.heroText)}</p>`, 'heroText');
  nextHtml = replaceRequired(nextHtml, /<h2 data-release-title>[^<]*<\/h2>/, `<h2 data-release-title>${escapeHtml(selected.title)}</h2>`, 'titulo visible');
  nextHtml = replaceRequired(nextHtml, /alt="Portada de [^"]*"/, `alt="Portada de ${escapeHtml(selected.title)}"`, 'texto de portada');

  return {
    script: scriptSource.replace(previousConfig[0], config),
    html: nextHtml
  };
};

const getNextPreviewVersion = (history: ReleaseHistory, slug: string) => {
  const versions = history.releases
    .map(release => release.shareUrl.match(new RegExp(`/lanzamientos/${slug}-v(\\d+)/`))?.[1])
    .filter(Boolean)
    .map(Number);

  return String(Math.max(0, ...versions) + 1);
};

export const reactivateHomeReleaseAction = async (formData: FormData) => {
  await requireAdmin();

  const slug = String(formData.get('slug') || '');
  const history = await readJson<ReleaseHistory>('release-history.json', { releases: [] });
  const selected = history.releases.find(release => release.slug === slug);
  if (!selected) throw new Error('No encontre ese lanzamiento.');

  const files = await applyHomeRelease(selected);
  await commitFiles([
    { path: 'script.js', content: files.script },
    { path: 'index.html', content: files.html }
  ], `Set ${selected.title} as latest release`);

  revalidatePath('/');
};

export const createHomeReleaseAction = async (formData: FormData) => {
  await requireAdmin();

  const spotifyUrl = String(formData.get('spotifyUrl') || '').trim();
  if (!spotifyUrl.includes('open.spotify.com/')) throw new Error('El enlace de Spotify no es valido.');

  const metadataResponse = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
  if (!metadataResponse.ok) throw new Error('Spotify no devolvio los datos de la cancion.');
  const metadata = await metadataResponse.json() as { title?: string; thumbnail_url?: string };

  const title = String(formData.get('title') || metadata.title || '').trim();
  const slug = slugify(String(formData.get('slug') || title));
  const featuring = String(formData.get('featuring') || '').trim();
  const socialArtist = featuring ? `Zaetta ft. ${featuring}` : 'Zaetta';
  const listenUrl = String(formData.get('listenUrl') || spotifyUrl).trim();
  const socialDescription = String(
    formData.get('socialDescription') || `Escucha ${title}, el nuevo lanzamiento de ${socialArtist}.`
  ).trim();
  const heroText = String(formData.get('heroText') || 'Música con propósito. Sonidos que trascienden.').trim();
  const history = await readJson<ReleaseHistory>('release-history.json', { releases: [] });
  const version = slugify(String(formData.get('version') || getNextPreviewVersion(history, slug)));

  if (!title) throw new Error('El nombre visible de la cancion es obligatorio.');
  if (!slug) throw new Error('El slug es obligatorio.');
  if (!version) throw new Error('La version preview es obligatoria.');
  if (!metadata.thumbnail_url) throw new Error('Spotify no devolvio portada.');

  const imageResponse = await fetchSpotifyCover(metadata.thumbnail_url);

  const coverPath = `assets/${slug}-cover.jpg`;
  const shareDirectory = `lanzamientos/${slug}-v${version}`;
  const statusDirectory = `estados/${slug}-v${version}`;
  const shareUrl = `https://www.lujourban.com/${shareDirectory}/`;
  const statusUrl = `https://www.lujourban.com/${statusDirectory}/`;
  const shareImageUrl = `https://www.lujourban.com/${coverPath}?v=${version}`;
  const browserTitle = `ZAETTA - Escucha ${title}`;
  const socialTitle = `${title} - ${socialArtist}`;
  const release = { title, slug, cover: coverPath, link: listenUrl, browserTitle, heroText, shareUrl, statusUrl };
  const releaseIndex = history.releases.findIndex(item => item.slug === slug);
  if (releaseIndex === -1) history.releases.push(release);
  else history.releases[releaseIndex] = release;

  const sharePage = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="website">
<meta property="og:url" content="${shareUrl}">
<meta property="og:title" content="${escapeHtml(socialTitle)}">
<meta property="og:description" content="${escapeHtml(socialDescription)}">
<meta property="og:image" content="${shareImageUrl}">
<meta property="og:image:secure_url" content="${shareImageUrl}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="600">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(socialTitle)}">
<meta name="twitter:description" content="${escapeHtml(socialDescription)}">
<meta name="twitter:image" content="${shareImageUrl}">
<meta http-equiv="refresh" content="0;url=/">
<title>${escapeHtml(socialTitle)}</title>
<script>window.location.replace('/');</script>
</head>
<body>
<p><a href="/">Ir al sitio oficial de Zaetta</a></p>
</body>
</html>
`;

  const statusPage = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="website">
<meta property="og:url" content="${statusUrl}">
<meta property="og:title" content="${escapeHtml(socialTitle)}">
<meta property="og:description" content="${escapeHtml(socialDescription)}">
<meta property="og:image" content="${shareImageUrl}">
<meta property="og:image:secure_url" content="${shareImageUrl}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="600">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(socialTitle)}">
<meta name="twitter:description" content="${escapeHtml(socialDescription)}">
<meta name="twitter:image" content="${shareImageUrl}">
<title>${escapeHtml(socialTitle)}</title>
</head>
<body style="margin:0;background:#020302;color:#fff;font-family:Arial,sans-serif;">
<main style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;">
<a href="/" style="color:inherit;text-decoration:none;">
<img src="${shareImageUrl}" alt="${escapeHtml(socialTitle)}" style="display:block;width:min(100%,1200px);height:auto;border:0;">
<p>Ir al sitio oficial de Zaetta</p>
</a>
</main>
</body>
</html>
`;

  const files = await applyHomeRelease(release);
  const coverBuffer = Buffer.from(await imageResponse.arrayBuffer());

  await commitFiles([
    { path: coverPath, content: coverBuffer.toString('base64'), encoding: 'base64' },
    { path: 'script.js', content: files.script },
    { path: 'index.html', content: files.html },
    { path: 'release-history.json', content: `${JSON.stringify(history, null, 2)}\n` },
    { path: `${shareDirectory}/index.html`, content: sharePage },
    { path: `${statusDirectory}/index.html`, content: statusPage }
  ], `Set ${title} as latest release`);

  revalidatePath('/');
};

export const saveArtistAction = safeAction(async (formData: FormData) => {
  await requireAdmin();

  await artistService.saveArtist({
    originalSlug: normalizeOptional(formData.get('originalSlug')),
    name: normalizeOptional(formData.get('name')),
    slug: normalizeOptional(formData.get('slug')),
    role: normalizeOptional(formData.get('role')),
    cardName: normalizeOptional(formData.get('cardName')),
    tagline: normalizeOptional(formData.get('tagline')),
    bio: normalizeOptional(formData.get('bio')),
    photo: normalizeOptional(formData.get('photo')),
    uploadedPhoto: await readUploadedImage(formData, 'photoFile'),
    links: formLinks(formData),
    socialOrder: formData.has('socialOrder') ? parseSocialOrder(formData.get('socialOrder')) : null,
    beatsEmbed: normalizeOptional(formData.get('beatsEmbed')),
    productionsEmbed: normalizeOptional(formData.get('productionsEmbed')),
    contactLabel: normalizeOptional(formData.get('contactLabel')),
    contactUrl: normalizeOptional(formData.get('contactUrl'))
  });

  revalidatePath('/');
});

export const moveArtistAction = safeAction(async (formData: FormData) => {
  await requireAdmin();

  await artistService.moveArtist(
    normalizeOptional(formData.get('slug')),
    normalizeOptional(formData.get('direction')) === 'up' ? 'up' : 'down'
  );

  revalidatePath('/');
});

export const deleteArtistAction = safeAction(async (formData: FormData) => {
  await requireAdmin();

  if (normalizeOptional(formData.get('confirmation')) !== 'BORRAR') {
    throw new ValidationError('Para borrar escribe BORRAR.');
  }
  await artistService.deleteArtist(normalizeOptional(formData.get('slug')));

  revalidatePath('/');
});

export const addArtistReleaseAction = safeAction(async (formData: FormData) => {
  await requireAdmin();

  await artistService.addRelease({
    artistSlug: normalizeOptional(formData.get('artistSlug')),
    title: normalizeOptional(formData.get('title')),
    slug: normalizeOptional(formData.get('slug')),
    link: normalizeOptional(formData.get('link')),
    cover: normalizeOptional(formData.get('cover')),
    uploadedCover: await readUploadedImage(formData, 'coverFile')
  });

  revalidatePath('/');
});

export const reactivateArtistReleaseAction = safeAction(async (formData: FormData) => {
  await requireAdmin();

  await artistService.reactivateRelease(
    normalizeOptional(formData.get('artistSlug')),
    normalizeOptional(formData.get('releaseSlug'))
  );

  revalidatePath('/');
});

export const addCasaCatalogPickAction = safeAction(async (formData: FormData) => {
  await requireAdmin();

  const pick = parseCasaCatalogPick(String(formData.get('pick') || ''));
  if (!pick) throw new ValidationError('Selecciona un lanzamiento valido.');

  const catalog = await readCasaCatalog();
  if (catalog.picks.some(item => samePick(item, pick))) throw new ConflictError('Ese lanzamiento ya esta fijado en el catalogo.');
  if (catalog.picks.length >= VISION_MAX_CRATE) throw new ValidationError(`Solo puedes fijar hasta ${VISION_MAX_CRATE} lanzamientos.`);

  catalog.picks.push(pick);
  await rebuildCasaCatalog(catalog, 'Pin release to Casa catalog');
});

export const removeCasaCatalogPickAction = safeAction(async (formData: FormData) => {
  await requireAdmin();

  const index = Number(formData.get('index'));
  const catalog = await readCasaCatalog();
  if (!Number.isInteger(index) || index < 0 || index >= catalog.picks.length) throw new NotFoundError('No encontre esa posicion del catalogo.');

  catalog.picks.splice(index, 1);
  await rebuildCasaCatalog(catalog, 'Unpin release from Casa catalog');
});

export const moveCasaCatalogPickAction = safeAction(async (formData: FormData) => {
  await requireAdmin();

  const index = Number(formData.get('index'));
  const direction = String(formData.get('direction') || '');
  const catalog = await readCasaCatalog();
  if (!Number.isInteger(index) || index < 0 || index >= catalog.picks.length) throw new NotFoundError('No encontre esa posicion del catalogo.');

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= catalog.picks.length) return;

  [catalog.picks[index], catalog.picks[targetIndex]] = [catalog.picks[targetIndex], catalog.picks[index]];
  await rebuildCasaCatalog(catalog, 'Reorder Casa catalog');
});
