import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const execFileAsync = promisify(execFile);
const rl = createInterface({ input, output });

const slugify = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const usage = () => {
  console.log('Uso: node reactivate-artist-release.mjs <slug>');
  console.log('Ejemplo: node reactivate-artist-release.mjs siervo-john');
};

const readJson = async (path, fallback) => {
  try {
    return await readFile(path, 'utf8').then(JSON.parse);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
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
  const [data, history] = await Promise.all([
    readJson('artist-data.json', { artists: [] }),
    readJson('artist-release-history.json', { artists: {} })
  ]);
  const artist = data.artists.find(item => item.slug === artistSlug);

  if (!artist) {
    const existing = data.artists.map(item => item.slug).join(', ') || 'sin artistas';
    throw new Error(`No existe un artista con slug "${artistSlug}". Slugs actuales: ${existing}`);
  }

  const releases = Array.isArray(history.artists[artistSlug]) ? history.artists[artistSlug] : [];
  if (!releases.length) {
    throw new Error(`No hay lanzamientos guardados para ${artist.name}.`);
  }

  console.log(`Lanzamientos de ${artist.name}:\n`);
  releases.forEach((release, index) => console.log(`${index + 1}. ${release.title}`));

  const answer = (await rl.question('\nEscribe el numero que quieres activar: ')).trim();
  const selected = releases[Number(answer) - 1];
  if (!selected) throw new Error('La opcion no es valida.');

  artist.release = selected;
  await writeFile('artist-data.json', `${JSON.stringify(data, null, 2)}\n`);
  await execFileAsync('node', ['generate-artist.mjs', '--build']);

  console.log(`\n${selected.title} quedo activo para ${artist.name}.`);
  console.log('Roster, pagina del artista y sitemap.xml reconstruidos.');
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
