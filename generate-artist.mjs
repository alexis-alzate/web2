import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });

const ask = async (question, fallback = '') => {
  const answer = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `)).trim();
  return answer || fallback;
};

const askYes = async (question, fallback = 'n') => {
  const answer = (await ask(`${question} (s/n)`, fallback)).toLowerCase();
  return answer.startsWith('s') || answer.startsWith('y');
};

const slugify = value => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const svg = {
  spotify: '<svg viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.79a4.85 4.85 0 01-1.07-.1z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24"><path d="M7.75 2C4.57 2 2 4.57 2 7.75v8.5C2 19.43 4.57 22 7.75 22h8.5C19.43 22 22 19.43 22 16.25v-8.5C22 4.57 19.43 2 16.25 2h-8.5zm0 2h8.5A3.75 3.75 0 0120 7.75v8.5A3.75 3.75 0 0116.25 20h-8.5A3.75 3.75 0 014 16.25v-8.5A3.75 3.75 0 017.75 4zm8.75 1a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zM12 7a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.5v-7l6 3.5-6 3.5z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>'
};

const copyAsset = async (source, slug, suffix) => {
  if (!source) return '';
  const extension = extname(source) || '.jpg';
  const target = `assets/${slug}-${suffix}${extension.toLowerCase()}`;
  await copyFile(source, target);
  return target;
};

const initials = name => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase())
  .join('');

const imageOrPlaceholder = (artist, className, prefix = '') => artist.photo
  ? `<img class="${className}" src="${prefix}${artist.photo}" alt="${escapeHtml(artist.name)}">`
  : `<div class="${className}" aria-label="Foto pendiente de ${escapeHtml(artist.name)}"><span>${escapeHtml(initials(artist.name))}</span></div>`;

const renderHeroPhoto = artist => artist.photo
  ? `<div class="hero-photo">
  <img src="../../${artist.photo}" alt="${escapeHtml(artist.name)}">
</div>`
  : `<div class="hero-photo artist-hero-placeholder" aria-label="Foto pendiente de ${escapeHtml(artist.name)}">
  <span>${escapeHtml(initials(artist.name))}</span>
</div>`;

const renderSocialGrid = artist => {
  const links = Object.entries(artist.links || {}).filter(([, url]) => url);
  if (!links.length) return '';

  const labels = { spotify: 'Spotify', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', whatsapp: 'WhatsApp' };
  return `<div class="divider"></div>
<section class="fade-up">
  <div class="social-grid">
${links.map(([key, url]) => `    <a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="social-item" data-track-event="artista_${artist.slug}_${key}_click" data-track-label="artist_${key}">
      ${svg[key] || ''}
      ${labels[key] || key}
    </a>`).join('\n')}
  </div>
</section>`;
};

const heroButtons = artist => {
  const buttons = [];
  if (artist.links?.spotify) {
    buttons.push(`<a href="${escapeHtml(artist.links.spotify)}" target="_blank" rel="noopener" class="btn-primary" data-track-event="artista_${artist.slug}_hero_spotify_click" data-track-label="artist_hero_spotify">
      ${svg.spotify.replace('<svg ', '<svg width="15" height="15" ')}
      Escucha ahora
    </a>`);
  }

  const secondaryEntries = [
    ['tiktok', 'TikTok'],
    ['instagram', 'Instagram'],
    ['youtube', 'YouTube']
  ].filter(([key]) => artist.links?.[key]);

  secondaryEntries.slice(0, buttons.length ? 1 : 2).forEach(([key, label]) => {
    buttons.push(`<a href="${escapeHtml(artist.links[key])}" target="_blank" rel="noopener" class="btn-secondary" data-track-event="artista_${artist.slug}_hero_${key}_click" data-track-label="artist_hero_${key}">
      ${svg[key].replace('<svg ', '<svg width="13" height="13" ')}
      ${label}
    </a>`);
  });

  buttons.push(`<a href="/artistas/" class="btn-secondary" data-track-event="artistas_directorio_click" data-track-label="artist_hero_artistas">
      Artistas
    </a>`);

  return buttons.join('\n    ');
};

const renderRelease = artist => {
  if (!artist.release?.title || !artist.release?.link) return '';

  const cover = artist.release.cover
    ? `<img src="../../${artist.release.cover}" alt="Portada de ${escapeHtml(artist.release.title)}">`
    : `<div class="artist-photo-placeholder" aria-hidden="true"><span>${escapeHtml(initials(artist.release.title))}</span></div>`;

  return `<div class="divider divider-music-inner"></div>
<section class="fade-up">
  <p class="section-label">Último lanzamiento</p>
  <div class="release-card">
    <div class="release-status">
      <p><span class="release-status-dot" aria-hidden="true"></span>Ya disponible</p>
    </div>
    <div class="release-feature">
      <a href="${escapeHtml(artist.release.link)}" target="_blank" rel="noopener" class="release-cover-link">${cover}</a>
      <div class="release-feature-copy">
        <h2>${escapeHtml(artist.release.title)}</h2>
        <p>${escapeHtml(artist.name)}</p>
        <div class="release-actions">
          <a href="${escapeHtml(artist.release.link)}" target="_blank" rel="noopener">Escuchar ahora</a>
        </div>
      </div>
    </div>
  </div>
</section>`;
};

const renderEmbedSection = (title, kicker, embed, eventName) => {
  if (!embed) return '';

  return `<div class="divider divider-music-inner"></div>
<section class="fade-up">
  <p class="section-label">${escapeHtml(title)}</p>
  <div class="beats-card">
    <div class="beats-info">
      <p class="beats-kicker">${escapeHtml(kicker)}</p>
    </div>
    <iframe
      title="${escapeHtml(title)}"
      data-track-event="${escapeHtml(eventName)}"
      data-track-label="${escapeHtml(title.toLowerCase())}"
      src="${escapeHtml(embed)}"
      height="352" style="width:100%;border:none;display:block;"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy">
    </iframe>
  </div>
</section>`;
};

const renderContact = artist => {
  if (!artist.contact?.url) return '';

  return `<div class="divider"></div>
<section class="fade-up">
  <p class="section-label">Contacto</p>
  <div class="contact-card">
    <a href="${escapeHtml(artist.contact.url)}" class="btn-send" target="_blank" rel="noopener">${escapeHtml(artist.contact.label || 'Contacto')}</a>
  </div>
</section>`;
};

const renderArtistPage = artist => {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${escapeHtml(`${artist.name}, ${artist.role.toLowerCase()} de Lujo Urban. ${artist.tagline}`)}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#000000">
<link rel="canonical" href="https://www.lujourban.com/artistas/${artist.slug}/">
<meta property="og:type" content="profile">
<meta property="og:url" content="https://www.lujourban.com/artistas/${artist.slug}/">
<meta property="og:site_name" content="LUJO URBAN">
<meta property="og:title" content="${escapeHtml(`${artist.name} - Lujo Urban`)}">
<meta property="og:description" content="${escapeHtml(artist.tagline)}">
<meta property="og:image" content="https://www.lujourban.com/${artist.photo || 'assets/zaetta-music-logo.jpg'}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(`${artist.name} - Lujo Urban`)}">
<meta name="twitter:description" content="${escapeHtml(artist.tagline)}">
<meta name="twitter:image" content="https://www.lujourban.com/${artist.photo || 'assets/zaetta-music-logo.jpg'}">
<title>${escapeHtml(`${artist.name} - Lujo Urban`)}</title>
<link rel="icon" href="../../assets/zaetta-music-logo.jpg" type="image/jpeg">
<link rel="stylesheet" href="../../styles.css">
</head>
<body class="artists-page">
<main>
${renderHeroPhoto(artist)}

<div class="hero-info fade-up">
  <h1 class="hero-name">${escapeHtml(artist.name)}</h1>
  <p class="hero-role">${escapeHtml(artist.role)}</p>
  <p class="hero-sub">${escapeHtml(artist.tagline)}</p>
  <div class="hero-btns">
    ${heroButtons(artist)}
  </div>
</div>
${renderSocialGrid(artist)}
${renderRelease(artist)}
${renderEmbedSection('Beats', 'Catálogo de beats', artist.beatsEmbed, `artista_${artist.slug}_beats_visto`)}
${renderEmbedSection('Producciones', 'Producciones destacadas', artist.productionsEmbed, `artista_${artist.slug}_producciones_visto`)}
${renderContact(artist)}
</main>
</body>
</html>
`;
};

const renderDirectory = artists => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Artistas aliados de Lujo Urban. Talento, lanzamientos y proyectos con identidad de marca.">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#000000">
<link rel="canonical" href="https://www.lujourban.com/artistas/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://www.lujourban.com/artistas/">
<meta property="og:site_name" content="LUJO URBAN">
<meta property="og:title" content="Artistas - Lujo Urban">
<meta property="og:description" content="Conoce los artistas aliados de Lujo Urban.">
<meta property="og:image" content="https://www.lujourban.com/assets/zaetta-music-logo.jpg">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Artistas - Lujo Urban">
<meta name="twitter:description" content="Conoce los artistas aliados de Lujo Urban.">
<meta name="twitter:image" content="https://www.lujourban.com/assets/zaetta-music-logo.jpg">
<title>Artistas - Lujo Urban</title>
<link rel="icon" href="../assets/zaetta-music-logo.jpg" type="image/jpeg">
<link rel="stylesheet" href="../styles.css">
</head>
<body class="artists-page">
<header class="artists-nav">
  <a href="/" class="artists-brand">
    <img src="../assets/zaetta-music-logo.jpg" alt="Lujo Urban">
    Lujo Urban
  </a>
  <a href="/" class="artists-back">Volver</a>
</header>

<main>
  <section class="artists-hero">
    <p class="artists-kicker">Lujo Urban presenta</p>
    <h1>Artistas<br><span>del movimiento.</span></h1>
    <p>Un espacio para descubrir talento aliado, lanzamientos y proyectos conectados con la visión de Lujo Urban.</p>
  </section>

  <section class="artist-list" aria-label="Artistas de Lujo Urban">
${artists.map(artist => `    <a href="/artistas/${artist.slug}/" class="artist-list-card">
      ${imageOrPlaceholder(artist, 'artist-photo-placeholder', '../')}
      <div class="artist-list-copy">
        <p>${escapeHtml(artist.role)}</p>
        <h2>${escapeHtml(artist.name)}</h2>
        <small>${escapeHtml(artist.tagline)}</small>
      </div>
    </a>`).join('\n')}
  </section>
</main>
</body>
</html>
`;

const updateSitemap = async artists => {
  let sitemap = await readFile('sitemap.xml', 'utf8');
  sitemap = sitemap.replace(/\n  <url>\n    <loc>https:\/\/www\.lujourban\.com\/artistas\/[\s\S]*?(?=\n<\/urlset>)/, '');
  const artistUrls = [`  <url>
    <loc>https://www.lujourban.com/artistas/</loc>
    <lastmod>2026-06-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`].concat(artists.map(artist => `  <url>
    <loc>https://www.lujourban.com/artistas/${artist.slug}/</loc>
    <lastmod>2026-06-03</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`));

  await writeFile('sitemap.xml', sitemap.replace('\n</urlset>', `\n${artistUrls.join('\n')}\n</urlset>`));
};

const buildArtists = async data => {
  await mkdir('artistas', { recursive: true });
  await Promise.all(data.artists.map(async artist => {
    await mkdir(`artistas/${artist.slug}`, { recursive: true });
    await writeFile(`artistas/${artist.slug}/index.html`, renderArtistPage(artist));
  }));

  await Promise.all([
    writeFile('artist-data.json', `${JSON.stringify(data, null, 2)}\n`),
    writeFile('artistas/index.html', renderDirectory(data.artists)),
    updateSitemap(data.artists)
  ]);
};

try {
  const data = await readFile('artist-data.json', 'utf8').then(JSON.parse);

  if (process.argv.includes('--build')) {
    await buildArtists(data);
    console.log('Paginas de artistas reconstruidas.');
    process.exit(0);
  }

  const name = await ask('Nombre artistico');
  if (!name) throw new Error('El nombre artistico no puede quedar vacio.');

  const slug = slugify(await ask('Nombre corto sin espacios ni tildes', slugify(name)));
  if (!slug) throw new Error('El nombre corto no puede quedar vacio.');

  const role = await ask('Rol visible', 'Artista aliado');
  const tagline = await ask('Frase corta', 'Música con identidad, visión y propósito.');
  const bio = await ask('Bio corta', `Perfil oficial de ${name} dentro del ecosistema Lujo Urban.`);
  const photoSource = await ask('Ruta de foto principal (dejalo vacio si aun no tienes foto)');
  const photo = await copyAsset(photoSource, slug, 'photo');

  const links = {};
  for (const key of ['spotify', 'tiktok', 'instagram', 'youtube', 'whatsapp']) {
    const url = await ask(`Link de ${key} (opcional)`);
    if (url) links[key] = url;
  }

  let release = null;
  if (await askYes('Tiene ultimo lanzamiento para mostrar')) {
    const title = await ask('Nombre del lanzamiento');
    const link = await ask('Link del lanzamiento');
    const coverSource = await ask('Ruta de portada del lanzamiento (opcional)');
    const cover = await copyAsset(coverSource, slug, 'release');
    release = title && link ? { title, link, cover } : null;
  }

  const beatsEmbed = await ask('Embed de beats Spotify/BeatStars (opcional)');
  const productionsEmbed = await ask('Embed de producciones Spotify/YouTube (opcional)');
  let contact = null;
  if (await askYes('Tiene boton de contacto o booking')) {
    const label = await ask('Texto del boton de contacto', 'Booking');
    const url = await ask('Link del contacto');
    contact = url ? { label, url } : null;
  }

  const nextArtist = { name, slug, role, tagline, bio, photo, links, release, beatsEmbed, productionsEmbed, contact };
  const index = data.artists.findIndex(artist => artist.slug === slug);
  if (index === -1) data.artists.push(nextArtist);
  else data.artists[index] = nextArtist;

  data.artists.sort((a, b) => a.name.localeCompare(b.name));

  await buildArtists(data);

  console.log('\nArtista generado correctamente.');
  console.log(`Pagina: https://www.lujourban.com/artistas/${slug}/`);
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
