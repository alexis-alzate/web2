import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const slugify = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const usage = () => {
  console.log('Uso: node move-artist.mjs <slug> <arriba|abajo|posicion>');
  console.log('Ejemplos:');
  console.log('  node move-artist.mjs siervo-john arriba');
  console.log('  node move-artist.mjs evangelista-gonzalez abajo');
  console.log('  node move-artist.mjs siervo-john 1');
};

const moveItem = (items, fromIndex, toIndex) => {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
};

try {
  const [, , rawSlug, rawDirection] = process.argv;

  if (process.argv.includes('--help')) {
    usage();
    process.exit(0);
  }

  if (!rawSlug || !rawDirection) {
    usage();
    process.exit(1);
  }

  const slug = slugify(rawSlug);
  const direction = String(rawDirection).trim().toLowerCase();
  const data = await readFile('artist-data.json', 'utf8').then(JSON.parse);
  const artists = Array.isArray(data.artists) ? data.artists : [];
  const fromIndex = artists.findIndex(artist => artist.slug === slug);

  if (fromIndex === -1) {
    const existing = artists.map(artist => artist.slug).join(', ') || 'sin artistas';
    throw new Error(`No existe un artista con slug "${slug}". Slugs actuales: ${existing}`);
  }

  let toIndex;
  if (direction === 'arriba' || direction === 'up') {
    toIndex = Math.max(0, fromIndex - 1);
  } else if (direction === 'abajo' || direction === 'down') {
    toIndex = Math.min(artists.length - 1, fromIndex + 1);
  } else if (/^\d+$/.test(direction)) {
    toIndex = Number(direction) - 1;
    if (toIndex < 0 || toIndex >= artists.length) {
      throw new Error(`La posicion debe estar entre 1 y ${artists.length}.`);
    }
  } else {
    throw new Error('Movimiento invalido. Usa arriba, abajo o un numero de posicion.');
  }

  if (fromIndex === toIndex) {
    console.log(`"${artists[fromIndex].name}" ya esta en esa posicion.`);
    process.exit(0);
  }

  data.artists = moveItem(artists, fromIndex, toIndex);
  await writeFile('artist-data.json', `${JSON.stringify(data, null, 2)}\n`);
  await execFileAsync('node', ['generate-artist.mjs', '--build']);

  console.log(`Artista movido: ${data.artists[toIndex].name}`);
  console.log(`Nueva posicion: ${toIndex + 1} de ${artists.length}`);
  console.log('Roster, artist-data.json y sitemap.xml reconstruidos.');
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
}
