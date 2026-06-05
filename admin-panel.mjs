import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { extname } from 'node:path';
import { promisify } from 'node:util';
import http from 'node:http';
import { networkInterfaces } from 'node:os';

const execFileAsync = promisify(execFile);
const port = Number(process.env.PORT || 4177);
const host = process.env.HOST || '0.0.0.0';
const adminPin = process.env.ADMIN_PIN || '';

const slugify = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const compactArtistName = value => String(value || '')
  .toLowerCase()
  .replace(/^(el|la|los|las)\s+/i, '')
  .split(/\s+/)
  .filter(Boolean)
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const readJson = async (path, fallback) => {
  try {
    return await readFile(path, 'utf8').then(JSON.parse);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};

const writeJson = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const replaceRequired = (source, pattern, replacement, label) => {
  if (!pattern.test(source)) throw new Error(`No encontre ${label}. No se modificaron los archivos.`);
  return source.replace(pattern, replacement);
};

const copyAsset = async (source, slug, suffix) => {
  if (!source) return '';
  const extension = extname(source) || '.jpg';
  const target = `assets/${slug}-${suffix}${extension.toLowerCase()}`;
  await copyFile(source, target);
  return target;
};

const rebuildArtists = () => execFileAsync('node', ['generate-artist.mjs', '--build']);

const getLanUrls = () => Object.values(networkInterfaces())
  .flat()
  .filter(item => item && item.family === 'IPv4' && !item.internal)
  .map(item => `http://${item.address}:${port}`);

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

const getBody = request => new Promise((resolve, reject) => {
  let body = '';
  request.on('data', chunk => {
    body += chunk;
    if (body.length > 1_000_000) request.destroy();
  });
  request.on('end', () => {
    if (!body) return resolve({});
    try {
      resolve(JSON.parse(body));
    } catch (error) {
      reject(new Error('El cuerpo de la peticion no es JSON valido.'));
    }
  });
  request.on('error', reject);
});

const send = (response, status, payload) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(payload));
};

const sendHtml = response => {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(page);
};

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

const sendAsset = async (request, response) => {
  const path = decodeURIComponent(request.url.replace(/^\//, ''));
  if (!path.startsWith('assets/')) return send(response, 404, { ok: false, message: 'Archivo no encontrado.' });
  const file = await readFile(path);
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(path).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  response.end(file);
};

const isAuthorized = request => !adminPin || request.headers['x-admin-pin'] === adminPin;

const apiState = async () => {
  const [artists, releases, artistReleases, scriptSource] = await Promise.all([
    readJson('artist-data.json', { artists: [] }),
    readJson('release-history.json', { releases: [] }),
    readJson('artist-release-history.json', { artists: {} }),
    readFile('script.js', 'utf8')
  ]);

  const currentConfig = scriptSource.match(/const latestRelease = \{[\s\S]*?\n\};/)?.[0] || '';
  const currentHomeRelease = {
    title: currentConfig.match(/title:\s*['"]([^'"]+)['"]/)?.[1] || '',
    slug: currentConfig.match(/slug:\s*['"]([^'"]+)['"]/)?.[1] || ''
  };

  let git = 'Sin revisar';
  try {
    const { stdout } = await execFileAsync('git', ['status', '--short', '--branch']);
    git = stdout.trim();
  } catch (error) {
    git = error.message;
  }

  return { artists, releases, artistReleases, currentHomeRelease, git };
};

const saveArtist = async payload => {
  const data = await readJson('artist-data.json', { artists: [] });
  const name = String(payload.name || '').trim();
  const slug = slugify(payload.slug || name);
  if (!name) throw new Error('El nombre del artista es obligatorio.');
  if (!slug) throw new Error('El slug del artista es obligatorio.');

  const existing = data.artists.find(artist => artist.slug === slug);
  const photo = payload.photoPath
    ? await copyAsset(String(payload.photoPath).trim(), slug, 'photo')
    : existing?.photo || '';

  const links = {};
  ['spotify', 'tiktok', 'instagram', 'youtube', 'facebook', 'whatsapp'].forEach(key => {
    const value = String(payload.links?.[key] || '').trim();
    if (value) links[key] = value;
  });

  const release = payload.release?.title && payload.release?.link ? {
    title: String(payload.release.title).trim(),
    slug: slugify(payload.release.slug || payload.release.title),
    link: String(payload.release.link).trim(),
    cover: existing?.release?.cover || ''
  } : null;

  if (release && payload.release.coverPath) {
    release.cover = await copyAsset(String(payload.release.coverPath).trim(), slug, `${release.slug}-cover`);
  }

  const contact = payload.contact?.url ? {
    label: String(payload.contact.label || 'Booking').trim(),
    url: String(payload.contact.url).trim()
  } : null;

  const nextArtist = {
    name,
    cardName: String(payload.cardName || compactArtistName(name)).trim(),
    slug,
    role: String(payload.role || 'Artista oficial').trim(),
    tagline: String(payload.tagline || 'Musica con identidad, vision y proposito.').trim(),
    bio: String(payload.bio || `Perfil oficial de ${name} dentro del ecosistema Lujo Urban.`).trim(),
    photo,
    links,
    release,
    beatsEmbed: String(payload.beatsEmbed || '').trim(),
    productionsEmbed: String(payload.productionsEmbed || '').trim(),
    contact
  };

  const index = data.artists.findIndex(artist => artist.slug === slug);
  if (index === -1) data.artists.push(nextArtist);
  else data.artists[index] = nextArtist;

  await writeJson('artist-data.json', data);
  await rebuildArtists();
  return nextArtist;
};

const moveArtist = async ({ slug, direction }) => {
  const { stdout, stderr } = await execFileAsync('node', ['move-artist.mjs', slug, direction]);
  return stdout || stderr;
};

const deleteArtist = async ({ slug, confirm }) => {
  if (confirm !== 'BORRAR') throw new Error('Debes escribir BORRAR para confirmar.');
  const { stdout, stderr } = await execFileAsync('node', ['delete-artist.mjs', slug, '--yes']);
  return stdout || stderr;
};

const addArtistRelease = async payload => {
  const data = await readJson('artist-data.json', { artists: [] });
  const history = await readJson('artist-release-history.json', { artists: {} });
  const artist = data.artists.find(item => item.slug === slugify(payload.artistSlug));
  if (!artist) throw new Error('No encontre ese artista.');

  const title = String(payload.title || '').trim();
  const link = String(payload.link || '').trim();
  const releaseSlug = slugify(payload.releaseSlug || title);
  if (!title) throw new Error('El titulo del lanzamiento es obligatorio.');
  if (!link) throw new Error('El link del lanzamiento es obligatorio.');

  const release = {
    title,
    slug: releaseSlug,
    link,
    cover: payload.coverPath ? await copyAsset(String(payload.coverPath).trim(), artist.slug, `${releaseSlug}-cover`) : ''
  };

  const releases = Array.isArray(history.artists[artist.slug]) ? history.artists[artist.slug] : [];
  const index = releases.findIndex(item => item.slug === release.slug);
  if (index === -1) releases.push(release);
  else releases[index] = release;

  history.artists[artist.slug] = releases;
  artist.release = release;

  await Promise.all([
    writeJson('artist-data.json', data),
    writeJson('artist-release-history.json', history)
  ]);
  await rebuildArtists();
  return release;
};

const reactivateArtistRelease = async payload => {
  const data = await readJson('artist-data.json', { artists: [] });
  const history = await readJson('artist-release-history.json', { artists: {} });
  const artist = data.artists.find(item => item.slug === slugify(payload.artistSlug));
  if (!artist) throw new Error('No encontre ese artista.');

  const releases = Array.isArray(history.artists[artist.slug]) ? history.artists[artist.slug] : [];
  const release = releases.find(item => item.slug === payload.releaseSlug);
  if (!release) throw new Error('No encontre ese lanzamiento en el historial del artista.');

  artist.release = release;
  await writeJson('artist-data.json', data);
  await rebuildArtists();
  return release;
};

const reactivateHomeRelease = async payload => {
  const selectedSlug = slugify(payload.slug);
  const [{ releases }, scriptSource, htmlSource] = await Promise.all([
    readJson('release-history.json', { releases: [] }),
    readFile('script.js', 'utf8'),
    readFile('index.html', 'utf8')
  ]);
  const selected = releases.find(release => release.slug === selectedSlug);
  if (!selected) throw new Error('No encontre ese lanzamiento del home.');

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

  await Promise.all([
    writeFile('script.js', scriptSource.replace(previousConfig[0], config)),
    writeFile('index.html', nextHtml)
  ]);

  return selected;
};

const addHomeRelease = async payload => {
  const spotifyUrl = String(payload.spotifyUrl || '').trim();
  if (!spotifyUrl.includes('open.spotify.com/')) throw new Error('El enlace de Spotify no es valido.');

  const metadataResponse = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
  if (!metadataResponse.ok) throw new Error('Spotify no devolvio los datos de la cancion.');

  const metadata = await metadataResponse.json();
  const title = String(payload.title || metadata.title || '').trim();
  const slug = slugify(payload.slug || title);
  const featuring = String(payload.featuring || '').trim();
  const socialArtist = featuring ? `Zaetta ft. ${featuring}` : 'Zaetta';
  const listenUrl = String(payload.listenUrl || spotifyUrl).trim();
  const socialDescription = String(
    payload.socialDescription || `Escucha ${title}, el nuevo lanzamiento de ${socialArtist}.`
  ).trim();
  const heroText = String(payload.heroText || 'Música con propósito. Sonidos que trascienden.').trim();
  const suggestedVersion = await getNextPreviewVersion(slug);
  const version = slugify(payload.version || suggestedVersion);

  if (!title) throw new Error('El nombre visible de la cancion es obligatorio.');
  if (!slug) throw new Error('El nombre corto de la cancion es obligatorio.');
  if (!version) throw new Error('La version de vista previa es obligatoria.');

  const coverFilename = `${slug}-cover.jpg`;
  const coverPath = `assets/${coverFilename}`;
  const shareDirectory = `lanzamientos/${slug}-v${version}`;
  const shareUrl = `https://www.lujourban.com/${shareDirectory}/`;
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
    throw new Error('La configuracion actual del home esta incompleta.');
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

  let nextHtml = htmlSource
    .replaceAll(previousLink, listenUrl)
    .replaceAll(previousCover, coverPath)
    .replaceAll(`release_${previousSlug}`, `release_${slug}`)
    .replaceAll(`data-track-content="${escapeHtml(previousTitle)}"`, `data-track-content="${escapeHtml(title)}"`);

  nextHtml = replaceRequired(nextHtml, /<p class="hero-sub" data-release-hero-text>[^<]*<\/p>/, `<p class="hero-sub" data-release-hero-text>${escapeHtml(heroText)}</p>`, 'heroText');
  nextHtml = replaceRequired(nextHtml, /<h2 data-release-title>[^<]*<\/h2>/, `<h2 data-release-title>${escapeHtml(title)}</h2>`, 'titulo visible');
  nextHtml = replaceRequired(nextHtml, /alt="Portada de [^"]*"/, `alt="Portada de ${escapeHtml(title)}"`, 'texto de portada');

  const history = await readJson('release-history.json', { releases: [] });
  const release = { title, slug, cover: coverPath, link: listenUrl, browserTitle, heroText, shareUrl };
  const previousReleaseIndex = history.releases.findIndex(item => item.slug === slug);
  if (previousReleaseIndex === -1) history.releases.push(release);
  else history.releases[previousReleaseIndex] = release;

  await Promise.all([
    mkdir('assets', { recursive: true }),
    mkdir(shareDirectory, { recursive: true })
  ]);
  await Promise.all([
    writeFile(coverPath, Buffer.from(await imageResponse.arrayBuffer())),
    writeFile('script.js', scriptSource.replace(previousConfig[0], config)),
    writeFile('index.html', nextHtml),
    writeJson('release-history.json', history),
    writeFile(`${shareDirectory}/index.html`, sharePage)
  ]);

  return release;
};

const routes = {
  'GET /api/state': apiState,
  'POST /api/artist/save': saveArtist,
  'POST /api/artist/move': moveArtist,
  'POST /api/artist/delete': deleteArtist,
  'POST /api/artist/release/add': addArtistRelease,
  'POST /api/artist/release/reactivate': reactivateArtistRelease,
  'POST /api/home-release/add': addHomeRelease,
  'POST /api/home-release/reactivate': reactivateHomeRelease,
  'POST /api/publish': async () => {
    try {
      const { stdout, stderr } = await execFileAsync('./publicar.sh', []);
      return stdout || stderr || 'Publicacion terminada.';
    } catch (error) {
      const output = [error.stdout, error.stderr, error.message]
        .filter(Boolean)
        .join('\n')
        .trim();
      throw new Error(`${output}\n\nNo se pudo publicar desde este panel. Si GitHub pide usuario o credenciales, ejecuta en tu terminal:\n\ngit push origin main`);
    }
  }
};

const server = http.createServer(async (request, response) => {
  const routeKey = `${request.method} ${request.url}`;
  try {
    if (request.method === 'GET' && request.url === '/') return sendHtml(response);
    if (request.method === 'GET' && request.url.startsWith('/assets/')) return sendAsset(request, response);
    if (!routes[routeKey]) return send(response, 404, { ok: false, message: 'Ruta no encontrada.' });
    if (!isAuthorized(request)) return send(response, 401, { ok: false, message: 'PIN incorrecto.' });

    const payload = request.method === 'GET' ? undefined : await getBody(request);
    const result = await routes[routeKey](payload);
    send(response, 200, { ok: true, result });
  } catch (error) {
    send(response, 500, { ok: false, message: error.message });
  }
});

server.listen(port, host, () => {
  console.log(`Panel Lujo Urban listo: http://127.0.0.1:${port}`);
  getLanUrls().forEach(url => console.log(`Celular en la misma red: ${url}`));
  if (adminPin) console.log('Proteccion activa: el panel pedira ADMIN_PIN.');
});

const page = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Panel Lujo Urban</title>
<style>
  :root { color-scheme: dark; --green: #39ff63; --line: rgba(57,255,99,.24); --panel: rgba(12,16,13,.86); }
  * { box-sizing: border-box; }
  body { margin: 0; background: radial-gradient(circle at 50% 0, rgba(57,255,99,.14), transparent 35%), linear-gradient(180deg, #061008, #010201 52%); color: #fff; font-family: Arial, sans-serif; }
  main { width: min(1060px, calc(100% - 36px)); margin: 0 auto; padding: 30px 0 58px; }
  header { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 24px; }
  h1, h2, h3, p { margin: 0; }
  h1 { font-size: clamp(2.1rem, 7vw, 4.2rem); letter-spacing: .2em; line-height: .95; text-transform: uppercase; }
  h2 { margin-bottom: 14px; font-size: .82rem; letter-spacing: .24em; text-transform: uppercase; color: var(--green); }
  h3 { font-size: 1.1rem; }
  small, label, .muted { color: rgba(255,255,255,.58); }
  section { margin-top: 16px; padding: 22px; border: 1px solid var(--line); border-radius: 18px; background: linear-gradient(180deg, rgba(9,15,10,.82), rgba(2,3,2,.95)); box-shadow: 0 0 28px rgba(57,255,99,.055); }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .toolbar { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: end; }
  .artist-list { display: grid; gap: 10px; }
  .artist-card { display: grid; grid-template-columns: 64px 1fr auto; gap: 14px; align-items: center; padding: 12px; border: 1px solid rgba(255,255,255,.08); border-radius: 14px; background: rgba(255,255,255,.025); }
  .photo { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; border: 1px solid rgba(57,255,99,.22); }
  .placeholder { display: grid; place-items: center; color: var(--green); font-size: 1.4rem; background: radial-gradient(circle, rgba(57,255,99,.22), rgba(0,0,0,.2)); }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
  button, input, textarea, select { font: inherit; }
  button { border: 1px solid var(--line); background: rgba(57,255,99,.12); color: #fff; border-radius: 999px; padding: 10px 14px; cursor: pointer; }
  button.primary { background: var(--green); color: #001406; border-color: var(--green); font-weight: 700; }
  button.danger { border-color: rgba(255,86,86,.5); background: rgba(255,86,86,.14); }
  input, textarea, select { width: 100%; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; background: rgba(0,0,0,.34); color: #fff; padding: 11px 12px; }
  textarea { min-height: 72px; resize: vertical; }
  label { display: grid; gap: 6px; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; }
  form { display: grid; gap: 12px; }
  .span-2 { grid-column: 1 / -1; }
  #git { overflow-wrap: anywhere; line-height: 1.45; }
  #log { white-space: pre-wrap; min-height: 44px; padding: 12px; border-radius: 12px; background: rgba(0,0,0,.3); color: rgba(255,255,255,.72); overflow-wrap: anywhere; }
  @media (max-width: 760px) { main { width: min(100% - 24px, 560px); padding-top: 22px; } header, .grid, .toolbar, .artist-card { grid-template-columns: 1fr; display: grid; } h1 { font-size: clamp(2rem, 12vw, 3.1rem); } section { padding: 16px; border-radius: 16px; } .actions { justify-content: flex-start; } }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <p class="muted">Panel privado</p>
      <h1>Lujo Urban</h1>
    </div>
    <button class="primary" id="refresh">Actualizar</button>
  </header>

  <section>
    <h2>Estado</h2>
    <p id="git" class="muted">Cargando...</p>
  </section>

  <section>
    <h2>Lanzamiento Principal</h2>
    <p class="muted" id="homeReleaseCurrent">Cargando...</p>
    <form id="newHomeReleaseForm" class="grid" style="margin-top:14px">
      <label class="span-2">Spotify de la cancion<input name="spotifyUrl" placeholder="https://open.spotify.com/track/..." required></label>
      <label>Nombre visible<input name="title" placeholder="Lo trae Spotify si lo dejas vacio"></label>
      <label>Slug<input name="slug" placeholder="nombre-corto"></label>
      <label>Featuring WhatsApp<input name="featuring" placeholder="dejalo vacio si es solo Zaetta"></label>
      <label>Version preview<input name="version" placeholder="automatico"></label>
      <label class="span-2">Link botones<input name="listenUrl" placeholder="too.fm o Spotify; si lo dejas vacio usa Spotify"></label>
      <label class="span-2">Texto WhatsApp<input name="socialDescription" placeholder="Escucha..., el nuevo lanzamiento..."></label>
      <label class="span-2">Texto hero<input name="heroText" value="Música con propósito. Sonidos que trascienden."></label>
      <button class="primary span-2">Crear nuevo lanzamiento de Zaetta</button>
    </form>
    <form id="homeReleaseForm" class="toolbar" style="margin-top:14px">
      <label>Reactivar cancion de Zaetta<select name="slug" id="homeRelease"></select></label>
      <button class="primary">Reactivar home</button>
    </form>
  </section>

  <section>
    <h2>Artistas</h2>
    <div class="artist-list" id="artists"></div>
  </section>

  <section>
    <h2>Crear o Actualizar Artista</h2>
    <form id="artistForm" class="grid">
      <label>Nombre<input name="name" required></label>
      <label>Slug<input name="slug" placeholder="siervo-john"></label>
      <label>Nombre tarjeta<input name="cardName"></label>
      <label>Rol<input name="role" value="Artista oficial"></label>
      <label class="span-2">Frase corta<input name="tagline"></label>
      <label class="span-2">Bio<textarea name="bio"></textarea></label>
      <label class="span-2">Ruta foto local<input name="photoPath" placeholder="/home/.../foto.jpg"></label>
      <label>Spotify<input name="spotify"></label>
      <label>TikTok<input name="tiktok"></label>
      <label>Instagram<input name="instagram"></label>
      <label>YouTube<input name="youtube"></label>
      <label>WhatsApp<input name="whatsapp"></label>
      <label>Contacto URL<input name="contactUrl"></label>
      <button class="primary span-2">Guardar artista</button>
    </form>
  </section>

  <section>
    <h2>Lanzamientos de Artistas</h2>
    <form id="artistReleaseForm" class="grid">
      <label>Artista<select name="artistSlug" id="releaseArtist"></select></label>
      <label>Titulo<input name="title" required></label>
      <label>Slug lanzamiento<input name="releaseSlug"></label>
      <label>Link<input name="link" required></label>
      <label class="span-2">Ruta portada local<input name="coverPath" placeholder="/home/.../portada.jpg"></label>
      <button class="primary span-2">Agregar y activar</button>
    </form>
    <form id="reactivateArtistReleaseForm" class="grid" style="margin-top:14px">
      <label>Artista<select name="artistSlug" id="historyArtist"></select></label>
      <label>Lanzamiento<select name="releaseSlug" id="historyRelease"></select></label>
      <button class="span-2">Reactivar lanzamiento del artista</button>
    </form>
  </section>

  <section>
    <h2>Publicacion</h2>
    <div class="actions" style="justify-content:flex-start;margin-top:12px">
      <button class="primary" id="publish">Publicar cambios</button>
    </div>
  </section>

  <section>
    <h2>Salida</h2>
    <div id="log">Listo.</div>
  </section>
</main>

<script>
let state = null;
const adminPin = localStorage.getItem('lujoAdminPin') || prompt('PIN del panel Lujo Urban') || '';
if (adminPin) localStorage.setItem('lujoAdminPin', adminPin);
const log = message => document.getElementById('log').textContent = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
const api = async (url, payload) => {
  const response = await fetch(url, {
    method: payload ? 'POST' : 'GET',
    headers: {
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
      ...(adminPin ? { 'X-Admin-Pin': adminPin } : {})
    },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.message);
  return data.result;
};
const initials = name => String(name || '').split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('');
const field = (form, name) => form.elements[name];

async function load() {
  state = await api('/api/state');
  document.getElementById('git').textContent = state.git || 'Limpio';
  renderHomeRelease();
  renderArtists();
  fillArtistSelects();
  fillHistoryReleases();
}

function renderHomeRelease() {
  const current = state.currentHomeRelease?.title || 'Sin lanzamiento detectado';
  document.getElementById('homeReleaseCurrent').textContent = 'Activo ahora: ' + current;
  document.getElementById('homeRelease').innerHTML = state.releases.releases
    .map(release => '<option value="' + release.slug + '">' + release.title + '</option>')
    .join('');
  if (state.currentHomeRelease?.slug) {
    document.getElementById('homeRelease').value = state.currentHomeRelease.slug;
  }
}

function renderArtists() {
  const root = document.getElementById('artists');
  root.innerHTML = state.artists.artists.map(artist => {
    const image = artist.photo
      ? '<img class="photo" src="/' + artist.photo + '" alt="">'
      : '<div class="photo placeholder">' + initials(artist.name) + '</div>';
    return '<article class="artist-card">' + image + '<div><h3>' + artist.cardName + '</h3><small>' + artist.slug + '</small><p class="muted">' + artist.tagline + '</p></div><div class="actions"><button data-move="' + artist.slug + ':arriba">Subir</button><button data-move="' + artist.slug + ':abajo">Bajar</button><button data-edit="' + artist.slug + '">Editar</button><button class="danger" data-delete="' + artist.slug + '">Borrar</button></div></article>';
  }).join('');
}

function fillArtistSelects() {
  const options = state.artists.artists.map(artist => '<option value="' + artist.slug + '">' + artist.cardName + '</option>').join('');
  document.getElementById('releaseArtist').innerHTML = options;
  document.getElementById('historyArtist').innerHTML = options;
}

function fillHistoryReleases() {
  const artistSlug = document.getElementById('historyArtist').value;
  const releases = state.artistReleases.artists[artistSlug] || [];
  document.getElementById('historyRelease').innerHTML = releases.map(release => '<option value="' + release.slug + '">' + release.title + '</option>').join('');
}

document.getElementById('refresh').addEventListener('click', () => load().catch(error => log(error.message)));
document.getElementById('historyArtist').addEventListener('change', fillHistoryReleases);

document.getElementById('newHomeReleaseForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const release = await api('/api/home-release/add', {
      spotifyUrl: field(form, 'spotifyUrl').value,
      title: field(form, 'title').value,
      slug: field(form, 'slug').value,
      featuring: field(form, 'featuring').value,
      version: field(form, 'version').value,
      listenUrl: field(form, 'listenUrl').value,
      socialDescription: field(form, 'socialDescription').value,
      heroText: field(form, 'heroText').value
    });
    form.reset();
    field(form, 'heroText').value = 'Música con propósito. Sonidos que trascienden.';
    log('Nuevo lanzamiento de Zaetta creado: ' + release.title + '\\nEnlace para compartir: ' + release.shareUrl);
    await load();
  } catch (error) {
    log(error.message);
  }
});

document.getElementById('homeReleaseForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const release = await api('/api/home-release/reactivate', { slug: field(form, 'slug').value });
    log('Lanzamiento principal reactivado: ' + release.title);
    await load();
  } catch (error) {
    log(error.message);
  }
});

document.getElementById('artists').addEventListener('click', async event => {
  const move = event.target.dataset.move;
  const edit = event.target.dataset.edit;
  const del = event.target.dataset.delete;
  try {
    if (move) {
      const [slug, direction] = move.split(':');
      log(await api('/api/artist/move', { slug, direction }));
      await load();
    }
    if (edit) {
      const artist = state.artists.artists.find(item => item.slug === edit);
      const form = document.getElementById('artistForm');
      field(form, 'name').value = artist.name || '';
      field(form, 'slug').value = artist.slug || '';
      field(form, 'cardName').value = artist.cardName || '';
      field(form, 'role').value = artist.role || '';
      field(form, 'tagline').value = artist.tagline || '';
      field(form, 'bio').value = artist.bio || '';
      field(form, 'spotify').value = artist.links?.spotify || '';
      field(form, 'tiktok').value = artist.links?.tiktok || '';
      field(form, 'instagram').value = artist.links?.instagram || '';
      field(form, 'youtube').value = artist.links?.youtube || '';
      field(form, 'whatsapp').value = artist.links?.whatsapp || '';
      field(form, 'contactUrl').value = artist.contact?.url || '';
      window.scrollTo({ top: form.offsetTop - 20, behavior: 'smooth' });
    }
    if (del) {
      const confirmText = prompt('Escribe BORRAR para eliminar ' + del);
      if (confirmText !== 'BORRAR') return;
      log(await api('/api/artist/delete', { slug: del, confirm: confirmText }));
      await load();
    }
  } catch (error) {
    log(error.message);
  }
});

document.getElementById('artistForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const payload = {
      name: field(form, 'name').value,
      slug: field(form, 'slug').value,
      cardName: field(form, 'cardName').value,
      role: field(form, 'role').value,
      tagline: field(form, 'tagline').value,
      bio: field(form, 'bio').value,
      photoPath: field(form, 'photoPath').value,
      links: {
        spotify: field(form, 'spotify').value,
        tiktok: field(form, 'tiktok').value,
        instagram: field(form, 'instagram').value,
        youtube: field(form, 'youtube').value,
        whatsapp: field(form, 'whatsapp').value
      },
      contact: { url: field(form, 'contactUrl').value }
    };
    await api('/api/artist/save', payload);
    form.reset();
    log('Artista guardado.');
    await load();
  } catch (error) {
    log(error.message);
  }
});

document.getElementById('artistReleaseForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api('/api/artist/release/add', {
      artistSlug: field(form, 'artistSlug').value,
      title: field(form, 'title').value,
      releaseSlug: field(form, 'releaseSlug').value,
      link: field(form, 'link').value,
      coverPath: field(form, 'coverPath').value
    });
    form.reset();
    log('Lanzamiento agregado y activado.');
    await load();
  } catch (error) {
    log(error.message);
  }
});

document.getElementById('reactivateArtistReleaseForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api('/api/artist/release/reactivate', {
      artistSlug: field(form, 'artistSlug').value,
      releaseSlug: field(form, 'releaseSlug').value
    });
    log('Lanzamiento de artista reactivado.');
    await load();
  } catch (error) {
    log(error.message);
  }
});

document.getElementById('publish').addEventListener('click', async () => {
  if (!confirm('Publicar cambios con git add, commit y push?')) return;
  try {
    log(await api('/api/publish', {}));
    await load();
  } catch (error) {
    log(error.message);
  }
});

load().catch(error => log(error.message));
</script>
</body>
</html>`;
