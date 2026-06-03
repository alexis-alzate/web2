import { readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const execFileAsync = promisify(execFile);

const slugify = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const usage = () => {
  console.log('Uso: node delete-artist.mjs <slug> [--yes]');
  console.log('Ejemplo: node delete-artist.mjs evangelista-gonzalez');
};

const confirmDelete = async artist => {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`Borrar "${artist.name}" (${artist.slug})? escribe BORRAR para confirmar: `);
    return answer.trim() === 'BORRAR';
  } finally {
    rl.close();
  }
};

try {
  const rawSlug = process.argv.find(arg => !arg.startsWith('--') && arg !== process.argv[0] && arg !== process.argv[1]);
  const skipConfirm = process.argv.includes('--yes');

  if (process.argv.includes('--help')) {
    usage();
    process.exit(0);
  }

  if (!rawSlug) {
    usage();
    process.exit(1);
  }

  const slug = slugify(rawSlug);
  if (!slug) throw new Error('El slug no puede quedar vacio.');

  const data = await readFile('artist-data.json', 'utf8').then(JSON.parse);
  const artist = data.artists.find(item => item.slug === slug);
  if (!artist) {
    const existing = data.artists.map(item => item.slug).join(', ') || 'sin artistas';
    throw new Error(`No existe un artista con slug "${slug}". Slugs actuales: ${existing}`);
  }

  if (!skipConfirm && !(await confirmDelete(artist))) {
    console.log('Operacion cancelada.');
    process.exit(0);
  }

  data.artists = data.artists.filter(item => item.slug !== slug);
  await writeFile('artist-data.json', `${JSON.stringify(data, null, 2)}\n`);
  await rm(`artistas/${slug}`, { recursive: true, force: true });
  await execFileAsync('node', ['generate-artist.mjs', '--build']);

  console.log(`Artista eliminado: ${artist.name}`);
  console.log('Roster, artist-data.json y sitemap.xml reconstruidos.');
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
}
