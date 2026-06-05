import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const execFileAsync = promisify(execFile);
const rl = createInterface({ input, output });

const ask = async (question, fallback = '') => {
  const answer = (await rl.question(`${question}${fallback ? ` [${fallback}]` : ''}: `)).trim();
  return answer || fallback;
};

const slugify = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const usage = () => {
  console.log('Uso: node add-artist-release.mjs <slug>');
  console.log('Ejemplo: node add-artist-release.mjs siervo-john');
};

const readJson = async (path, fallback) => {
  try {
    return await readFile(path, 'utf8').then(JSON.parse);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};

const copyAsset = async (source, artistSlug, releaseSlug) => {
  if (!source) return '';
  const extension = extname(source) || '.jpg';
  const target = `assets/${artistSlug}-${releaseSlug}-cover${extension.toLowerCase()}`;
  await copyFile(source, target);
  return target;
};

const upsertRelease = (releases, release) => {
  const index = releases.findIndex(item => item.slug === release.slug);
  if (index === -1) return releases.concat(release);
  return releases.map((item, itemIndex) => itemIndex === index ? release : item);
};

try {
  const [, , rawSlug] = process.argv;

  if (process.argv.includes('--help')) {
    usage();
    process.exit(0);
  }

  if (!rawSlug) {
    usage();
    process.exit(1);
  }

  const artistSlug = slugify(rawSlug);
  const data = await readJson('artist-data.json', { artists: [] });
  const artist = data.artists.find(item => item.slug === artistSlug);

  if (!artist) {
    const existing = data.artists.map(item => item.slug).join(', ') || 'sin artistas';
    throw new Error(`No existe un artista con slug "${artistSlug}". Slugs actuales: ${existing}`);
  }

  const title = await ask('Nombre del lanzamiento');
  const link = await ask('Link del lanzamiento');
  const releaseSlug = slugify(await ask('Nombre corto del lanzamiento', slugify(title)));
  const coverSource = await ask('Ruta de portada (opcional)');

  if (!title) throw new Error('El nombre del lanzamiento no puede quedar vacio.');
  if (!link) throw new Error('El link del lanzamiento no puede quedar vacio.');
  if (!releaseSlug) throw new Error('El nombre corto no puede quedar vacio.');

  const cover = await copyAsset(coverSource, artistSlug, releaseSlug);
  const release = { title, slug: releaseSlug, link, cover };
  const history = await readJson('artist-release-history.json', { artists: {} });
  const currentHistory = Array.isArray(history.artists[artistSlug]) ? history.artists[artistSlug] : [];

  history.artists[artistSlug] = upsertRelease(currentHistory, release);
  artist.release = release;

  await Promise.all([
    writeFile('artist-data.json', `${JSON.stringify(data, null, 2)}\n`),
    writeFile('artist-release-history.json', `${JSON.stringify(history, null, 2)}\n`)
  ]);
  await execFileAsync('node', ['generate-artist.mjs', '--build']);

  console.log(`\nLanzamiento agregado para ${artist.name}: ${title}`);
  console.log('Historial, roster, pagina del artista y sitemap.xml reconstruidos.');
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
