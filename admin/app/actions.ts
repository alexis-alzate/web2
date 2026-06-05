'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth';
import { commitFiles, readFile, readJson } from '@/lib/github';
import {
  type Artist,
  type ArtistData,
  type ArtistRelease,
  type ArtistReleaseHistory,
  buildArtistFiles,
  compactArtistName,
  slugify as slugifyArtist
} from '@/lib/artist-renderer';

type Release = {
  title: string;
  slug: string;
  cover: string;
  link: string;
  browserTitle: string;
  heroText: string;
  shareUrl: string;
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

const requireAdmin = async () => {
  if (!(await isAuthenticated())) throw new Error('No autenticado.');
};

const cleanLinks = (formData: FormData) => {
  const links: Record<string, string> = {};
  ['spotify', 'tiktok', 'instagram', 'youtube', 'facebook', 'whatsapp'].forEach(key => {
    const value = String(formData.get(key) || '').trim();
    if (value) links[key] = value;
  });
  return links;
};

const normalizeOptional = (value: FormDataEntryValue | null) => {
  const text = String(value || '').trim();
  return text || '';
};

const readArtistBuildInputs = async () => Promise.all([
  readJson<ArtistData>('artist-data.json', { artists: [] }),
  readFile('sitemap.xml')
]);

const commitArtistBuild = async (data: ArtistData, sitemap: string, message: string) => {
  await commitFiles(buildArtistFiles(data, sitemap), message);
  revalidatePath('/');
};

const findArtist = (data: ArtistData, slug: string) => {
  const artist = data.artists.find(item => item.slug === slug);
  if (!artist) throw new Error('No encontre ese artista.');
  return artist;
};

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

  const imageResponse = await fetch(metadata.thumbnail_url);
  if (!imageResponse.ok) throw new Error('No pude descargar la portada desde Spotify.');

  const coverPath = `assets/${slug}-cover.jpg`;
  const shareDirectory = `lanzamientos/${slug}-v${version}`;
  const shareUrl = `https://www.lujourban.com/${shareDirectory}/`;
  const shareImageUrl = `https://www.lujourban.com/${coverPath}?v=${version}`;
  const browserTitle = `ZAETTA - Escucha ${title}`;
  const socialTitle = `${title} - ${socialArtist}`;
  const release = { title, slug, cover: coverPath, link: listenUrl, browserTitle, heroText, shareUrl };
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
<meta property="og:image:width" content="300">
<meta property="og:image:height" content="300">
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

  const files = await applyHomeRelease(release);
  const coverBase64 = Buffer.from(await imageResponse.arrayBuffer()).toString('base64');

  await commitFiles([
    { path: coverPath, content: coverBase64, encoding: 'base64' },
    { path: 'script.js', content: files.script },
    { path: 'index.html', content: files.html },
    { path: 'release-history.json', content: `${JSON.stringify(history, null, 2)}\n` },
    { path: `${shareDirectory}/index.html`, content: sharePage }
  ], `Set ${title} as latest release`);

  revalidatePath('/');
};

export const saveArtistAction = async (formData: FormData) => {
  await requireAdmin();

  const originalSlug = normalizeOptional(formData.get('originalSlug'));
  const name = normalizeOptional(formData.get('name'));
  const slug = slugifyArtist(normalizeOptional(formData.get('slug')) || name);
  if (!name) throw new Error('El nombre artistico es obligatorio.');
  if (!slug) throw new Error('El slug del artista es obligatorio.');

  const role = normalizeOptional(formData.get('role')) || 'Artista oficial';
  const cardName = normalizeOptional(formData.get('cardName')) || compactArtistName(name);
  const tagline = normalizeOptional(formData.get('tagline')) || 'Música con identidad, visión y propósito.';
  const bio = normalizeOptional(formData.get('bio')) || `Perfil oficial de ${name} dentro del ecosistema Lujo Urban.`;
  const photo = normalizeOptional(formData.get('photo'));
  const beatsEmbed = normalizeOptional(formData.get('beatsEmbed'));
  const productionsEmbed = normalizeOptional(formData.get('productionsEmbed'));
  const contactLabel = normalizeOptional(formData.get('contactLabel'));
  const contactUrl = normalizeOptional(formData.get('contactUrl'));

  const [data, sitemap] = await readArtistBuildInputs();
  const existingIndex = originalSlug
    ? data.artists.findIndex(artist => artist.slug === originalSlug)
    : data.artists.findIndex(artist => artist.slug === slug);
  const existingArtist = existingIndex >= 0 ? data.artists[existingIndex] : null;

  const nextArtist: Artist = {
    name,
    cardName,
    slug,
    role,
    tagline,
    bio,
    photo,
    links: cleanLinks(formData),
    release: existingArtist?.release || null,
    beatsEmbed,
    productionsEmbed,
    contact: contactUrl ? { label: contactLabel || 'Booking', url: contactUrl } : null
  };

  if (existingIndex >= 0) data.artists[existingIndex] = nextArtist;
  else data.artists.push(nextArtist);

  await commitArtistBuild(data, sitemap, existingArtist ? `Update artist ${name}` : `Create artist ${name}`);
};

export const moveArtistAction = async (formData: FormData) => {
  await requireAdmin();

  const slug = normalizeOptional(formData.get('slug'));
  const direction = normalizeOptional(formData.get('direction'));
  const [data, sitemap] = await readArtistBuildInputs();
  const fromIndex = data.artists.findIndex(artist => artist.slug === slug);
  if (fromIndex < 0) throw new Error('No encontre ese artista.');

  const toIndex = direction === 'up'
    ? Math.max(0, fromIndex - 1)
    : Math.min(data.artists.length - 1, fromIndex + 1);

  if (toIndex === fromIndex) return;
  const [artist] = data.artists.splice(fromIndex, 1);
  data.artists.splice(toIndex, 0, artist);

  await commitArtistBuild(data, sitemap, `Move artist ${artist.name}`);
};

export const deleteArtistAction = async (formData: FormData) => {
  await requireAdmin();

  const slug = normalizeOptional(formData.get('slug'));
  const confirmation = normalizeOptional(formData.get('confirmation'));
  if (confirmation !== 'BORRAR') throw new Error('Para borrar escribe BORRAR.');

  const [data, sitemap] = await readArtistBuildInputs();
  const artist = findArtist(data, slug);
  data.artists = data.artists.filter(item => item.slug !== slug);

  await commitArtistBuild(data, sitemap, `Delete artist ${artist.name}`);
};

export const addArtistReleaseAction = async (formData: FormData) => {
  await requireAdmin();

  const artistSlug = normalizeOptional(formData.get('artistSlug'));
  const title = normalizeOptional(formData.get('title'));
  const releaseSlug = slugifyArtist(normalizeOptional(formData.get('slug')) || title);
  const link = normalizeOptional(formData.get('link'));
  const cover = normalizeOptional(formData.get('cover'));

  if (!artistSlug) throw new Error('Selecciona un artista.');
  if (!title) throw new Error('El nombre del lanzamiento es obligatorio.');
  if (!releaseSlug) throw new Error('El slug del lanzamiento es obligatorio.');
  if (!link) throw new Error('El link del lanzamiento es obligatorio.');

  const [data, history, sitemap] = await Promise.all([
    readJson<ArtistData>('artist-data.json', { artists: [] }),
    readJson<ArtistReleaseHistory>('artist-release-history.json', { artists: {} }),
    readFile('sitemap.xml')
  ]);

  const artist = findArtist(data, artistSlug);
  const release: ArtistRelease = { title, slug: releaseSlug, link, cover };
  const releases = Array.isArray(history.artists[artistSlug]) ? history.artists[artistSlug] : [];
  const releaseIndex = releases.findIndex(item => item.slug === releaseSlug);
  if (releaseIndex >= 0) releases[releaseIndex] = release;
  else releases.push(release);

  history.artists[artistSlug] = releases;
  artist.release = release;

  await commitFiles([
    ...buildArtistFiles(data, sitemap),
    { path: 'artist-release-history.json', content: `${JSON.stringify(history, null, 2)}\n` }
  ], `Set ${title} as latest release for ${artist.name}`);

  revalidatePath('/');
};

export const reactivateArtistReleaseAction = async (formData: FormData) => {
  await requireAdmin();

  const artistSlug = normalizeOptional(formData.get('artistSlug'));
  const releaseSlug = normalizeOptional(formData.get('releaseSlug'));

  const [data, history, sitemap] = await Promise.all([
    readJson<ArtistData>('artist-data.json', { artists: [] }),
    readJson<ArtistReleaseHistory>('artist-release-history.json', { artists: {} }),
    readFile('sitemap.xml')
  ]);

  const artist = findArtist(data, artistSlug);
  const selected = (history.artists[artistSlug] || []).find(release => release.slug === releaseSlug);
  if (!selected) throw new Error('No encontre ese lanzamiento del artista.');

  artist.release = selected;
  await commitArtistBuild(data, sitemap, `Reactivate ${selected.title} for ${artist.name}`);
};
