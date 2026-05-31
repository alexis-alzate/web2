import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

try {
  const spotifyUrl = await ask('Pega el enlace de Spotify de la cancion');
  if (!spotifyUrl.includes('open.spotify.com/')) throw new Error('El enlace de Spotify no es valido.');

  const metadataResponse = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
  if (!metadataResponse.ok) throw new Error('Spotify no devolvio los datos de la cancion.');

  const metadata = await metadataResponse.json();
  const title = await ask('Nombre visible de la cancion', metadata.title);
  const slug = await ask('Nombre corto sin espacios ni tildes', slugify(title));
  const listenUrl = await ask('Enlace para los botones (too.fm o Spotify)', spotifyUrl);
  const socialDescription = await ask(
    'Texto que aparecera al compartir por WhatsApp',
    `Escucha ${title}, el nuevo lanzamiento de ZAETTA.`
  );
  const heroText = await ask(
    'Texto visible debajo de Artista - Productor',
    'Musica con proposito. Sonidos que trascienden.'
  );
  const version = await ask('Version de la vista previa', '1');

  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('El nombre corto solo puede tener letras, numeros y guiones.');
  if (!/^[a-z0-9-]+$/.test(version)) throw new Error('La version solo puede tener letras, numeros y guiones.');

  const coverFilename = `${slug}-cover.jpg`;
  const coverPath = `assets/${coverFilename}`;
  const shareUrl = `https://www.lujourban.com/?lanzamiento=${slug}-v${version}`;
  const shareImageUrl = `https://www.lujourban.com/${coverPath}?v=${version}`;
  const browserTitle = `ZAETTA - Escucha ${title}`;
  const socialTitle = `${title} - ZAETTA`;

  const [scriptSource, htmlSource, imageResponse] = await Promise.all([
    readFile('script.js', 'utf8'),
    readFile('index.html', 'utf8'),
    fetch(metadata.thumbnail_url)
  ]);

  if (!imageResponse.ok) throw new Error('No pude descargar la portada desde Spotify.');

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
  browserTitle: ${JSON.stringify(browserTitle)},
  heroText: ${JSON.stringify(heroText)}
};`;

  let nextScript = scriptSource.replace(previousConfig[0], config);
  let nextHtml = htmlSource
    .replaceAll(previousLink, listenUrl)
    .replaceAll(previousCover, coverPath)
    .replaceAll(`release_${previousSlug}`, `release_${slug}`)
    .replaceAll(`data-track-content="${escapeHtml(previousTitle)}"`, `data-track-content="${escapeHtml(title)}"`);

  nextHtml = replaceRequired(nextHtml, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${shareUrl}">`, 'og:url');
  nextHtml = replaceRequired(nextHtml, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(socialTitle)}">`, 'og:title');
  nextHtml = replaceRequired(nextHtml, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(socialDescription)}">`, 'og:description');
  nextHtml = replaceRequired(nextHtml, /<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${shareImageUrl}">`, 'og:image');
  nextHtml = replaceRequired(nextHtml, /<meta property="og:image:secure_url" content="[^"]*">/, `<meta property="og:image:secure_url" content="${shareImageUrl}">`, 'og:image:secure_url');
  nextHtml = replaceRequired(nextHtml, /<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escapeHtml(socialTitle)}">`, 'twitter:title');
  nextHtml = replaceRequired(nextHtml, /<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escapeHtml(socialDescription)}">`, 'twitter:description');
  nextHtml = replaceRequired(nextHtml, /<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${shareImageUrl}">`, 'twitter:image');
  nextHtml = replaceRequired(nextHtml, /<title>[^<]*<\/title>/, `<title>${escapeHtml(browserTitle)}</title>`, 'title');
  nextHtml = replaceRequired(nextHtml, /<p class="hero-sub" data-release-hero-text>[^<]*<\/p>/, `<p class="hero-sub" data-release-hero-text>${escapeHtml(heroText)}</p>`, 'heroText');
  nextHtml = replaceRequired(nextHtml, /<h2 data-release-title>[^<]*<\/h2>/, `<h2 data-release-title>${escapeHtml(title)}</h2>`, 'titulo visible');
  nextHtml = replaceRequired(nextHtml, /alt="Portada de [^"]*"/, `alt="Portada de ${escapeHtml(title)}"`, 'texto de portada');

  await mkdir('assets', { recursive: true });
  await Promise.all([
    writeFile(coverPath, Buffer.from(await imageResponse.arrayBuffer())),
    writeFile('script.js', nextScript),
    writeFile('index.html', nextHtml)
  ]);

  console.log('\nActualizacion terminada.');
  console.log(`Portada guardada: ${coverPath}`);
  console.log(`Enlace que debes compartir: ${shareUrl}`);
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
