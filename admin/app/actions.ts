'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '@/lib/auth';
import { commitFiles, readFile, readJson } from '@/lib/github';

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
