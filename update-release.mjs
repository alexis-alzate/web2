import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });

const ask = async (question, fallback = '') => {
  const answer = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `)).trim();
  return answer || fallback;
};

const slugify = value => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const escapeHtml = value => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const replaceRequired = (source, pattern, replacement, label) => {
  if (!pattern.test(source)) throw new Error(`No encontre ${label}. No se modificaron los archivos.`);
  return source.replace(pattern, replacement);
};

const getHighResSpotifyImageUrl = url => url.replace('0000b273', '00001e02');

const fetchSpotifyCover = async thumbnailUrl => {
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

const getNextPreviewVersion = async slug => {
  try {
    const entries = await readdir('lanzamientos', { withFileTypes: true });
    const versions = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name.match(new RegExp(`^${slug}-v(\\d+)$`))?.[1])
      .filter(Boolean)
      .map(Number);

    return String(Math.max(0, ...versions) + 1);
  } catch {
    return '1';
  }
};

try {
  const spotifyUrl = await ask('Pega el enlace de Spotify de la cancion');
  if (!spotifyUrl.includes('open.spotify.com/')) throw new Error('El enlace de Spotify no es valido.');

  const metadataResponse = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
  if (!metadataResponse.ok) throw new Error('Spotify no devolvio los datos de la cancion.');

  const metadata = await metadataResponse.json();
  const title = await ask('Nombre visible de la cancion', metadata.title);
  const slug = slugify(await ask('Nombre corto sin espacios ni tildes', slugify(title)));
  const featuring = await ask('Featuring para WhatsApp (dejalo vacio si la cancion es solo de Zaetta)');
  const socialArtist = featuring ? `Zaetta ft. ${featuring}` : 'Zaetta';
  const listenUrl = await ask('Enlace para los botones (too.fm o Spotify)', spotifyUrl);
  const socialDescription = await ask(
    'Texto que aparecera al compartir por WhatsApp',
    `Escucha ${title}, el nuevo lanzamiento de ${socialArtist}.`
  );
  const heroText = await ask(
    'Texto visible debajo de Artista - Productor',
    'Música con propósito. Sonidos que trascienden.'
  );
  const suggestedVersion = await getNextPreviewVersion(slug);
  const version = slugify(await ask('Version de la vista previa', suggestedVersion));

  if (!slug) throw new Error('El nombre corto no puede quedar vacio.');
  if (!version) throw new Error('La version no puede quedar vacia.');

  const coverFilename = `${slug}-cover.jpg`;
  const coverPath = `assets/${coverFilename}`;
  const shareDirectory = `lanzamientos/${slug}-v${version}`;
  const statusDirectory = `estados/${slug}-v${version}`;
  const shareUrl = `https://www.lujourban.com/${shareDirectory}/`;
  const statusUrl = `https://www.lujourban.com/${statusDirectory}/`;
  const shareImageUrl = `https://www.lujourban.com/${coverPath}?v=${version}`;
  const browserTitle = `ZAETTA - Escucha ${title}`;
  const socialTitle = `${title} - ${socialArtist}`;

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
<meta http-equiv="refresh" content="0;url=/">
<title>${escapeHtml(socialTitle)}</title>
<script>window.location.replace('/');</script>
</head>
<body>
<p><a href="/">Ir al sitio oficial de Zaetta</a></p>
</body>
</html>
`;

  const [scriptSource, htmlSource, imageResponse] = await Promise.all([
    readFile('script.js', 'utf8'),
    readFile('index.html', 'utf8'),
    fetchSpotifyCover(metadata.thumbnail_url)
  ]);

  const previousConfig = scriptSource.match(/const latestRelease = \{[\s\S]*?\n\};/);
  if (!previousConfig) throw new Error('No encontre latestRelease en script.js.');

  const previousLink = previousConfig[0].match(/link:\s*['"]([^'"]+)['"]/)?.[1];
  const previousSlug = previousConfig[0].match(/slug:\s*['"]([^'"]+)['"]/)?.[1];
  const previousCover = previousConfig[0].match(/cover:\s*['"]([^'"]+)['"]/)?.[1];
  const previousTitle = previousConfig[0].match(/trackingTitle:\s*['"]([^'"]+)['"]/)?.[1];
  if (!previousLink || !previousSlug || !previousCover || !previousTitle) {
    throw new Error('La configuracion actual esta incompleta.');
  }

  const config = `const latestRelease = {
  title: ${JSON.stringify(title)},
  trackingTitle: ${JSON.stringify(title)},
  slug: ${JSON.stringify(slug)},
  artist: 'ZAETTA',
  cover: ${JSON.stringify(coverPath)},
  link: ${JSON.stringify(listenUrl)},
  shareUrl: ${JSON.stringify(shareUrl)},
  browserTitle: ${JSON.stringify(browserTitle)},
  heroText: ${JSON.stringify(heroText)}
};`;

  let nextScript = scriptSource.replace(previousConfig[0], config);
  let nextHtml = htmlSource
    .replaceAll(previousLink, listenUrl)
    .replaceAll(previousCover, coverPath)
    .replaceAll(`release_${previousSlug}`, `release_${slug}`)
    .replaceAll(`data-track-content="${escapeHtml(previousTitle)}"`, `data-track-content="${escapeHtml(title)}"`);

  nextHtml = replaceRequired(nextHtml, /<p class="hero-sub" data-release-hero-text>[^<]*<\/p>/, `<p class="hero-sub" data-release-hero-text>${escapeHtml(heroText)}</p>`, 'heroText');
  nextHtml = replaceRequired(nextHtml, /<h2 data-release-title>[^<]*<\/h2>/, `<h2 data-release-title>${escapeHtml(title)}</h2>`, 'titulo visible');
  nextHtml = replaceRequired(nextHtml, /alt="Portada de [^"]*"/, `alt="Portada de ${escapeHtml(title)}"`, 'texto de portada');

  const history = await readFile('release-history.json', 'utf8').then(JSON.parse);
  const release = { title, slug, cover: coverPath, link: listenUrl, browserTitle, heroText, shareUrl, statusUrl };
  const previousReleaseIndex = history.releases.findIndex(item => item.slug === slug);
  if (previousReleaseIndex === -1) {
    history.releases.push(release);
  } else {
    history.releases[previousReleaseIndex] = release;
  }

  await Promise.all([
    mkdir('assets', { recursive: true }),
    mkdir(shareDirectory, { recursive: true }),
    mkdir(statusDirectory, { recursive: true })
  ]);
  const coverBuffer = Buffer.from(await imageResponse.arrayBuffer());
  await writeFile(coverPath, coverBuffer);

  await Promise.all([
    writeFile('script.js', nextScript),
    writeFile('index.html', nextHtml),
    writeFile('release-history.json', `${JSON.stringify(history, null, 2)}\n`),
    writeFile(`${shareDirectory}/index.html`, sharePage),
    writeFile(`${statusDirectory}/index.html`, statusPage)
  ]);

  console.log('\nActualizacion terminada.');
  console.log(`Portada guardada: ${coverPath}`);
  console.log(`Enlace para chat: ${shareUrl}`);
  console.log(`Enlace para estado: ${statusUrl}`);
  console.log('\nAhora publica con:');
  console.log('git add .');
  console.log(`git commit -m "Set ${title} as latest release"`);
  console.log('git push origin main');
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
