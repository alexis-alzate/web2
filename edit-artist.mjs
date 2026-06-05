import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
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
  console.log('Uso: node edit-artist.mjs <slug> <campo> <valor>');
  console.log('Ejemplos:');
  console.log('  node edit-artist.mjs siervo-john cardName "El Siervo Jhon"');
  console.log('  node edit-artist.mjs siervo-john tagline "Identidad cristiana con vision urbana."');
  console.log('  node edit-artist.mjs siervo-john links.instagram "https://instagram.com/usuario"');
  console.log('  node edit-artist.mjs siervo-john photo "/ruta/foto.jpg"');
  console.log('  node edit-artist.mjs siervo-john release.title "Nuevo sencillo"');
  console.log('  node edit-artist.mjs siervo-john release.link "https://open.spotify.com/..."');
  console.log('  node edit-artist.mjs siervo-john release.cover "/ruta/portada.jpg"');
  console.log('  node edit-artist.mjs siervo-john links.spotify --clear');
};

const editableFields = new Set([
  'name',
  'cardName',
  'role',
  'tagline',
  'bio',
  'photo',
  'links.spotify',
  'links.tiktok',
  'links.instagram',
  'links.youtube',
  'links.facebook',
  'links.whatsapp',
  'release.title',
  'release.link',
  'release.cover',
  'beatsEmbed',
  'productionsEmbed',
  'contact.label',
  'contact.url'
]);

const copyAsset = async (source, slug, suffix) => {
  if (!source) return '';
  const extension = extname(source) || '.jpg';
  const target = `assets/${slug}-${suffix}${extension.toLowerCase()}`;
  await copyFile(source, target);
  return target;
};

const ensureObject = (target, key) => {
  if (!target[key] || typeof target[key] !== 'object') target[key] = {};
  return target[key];
};

const cleanupEmptyObjects = artist => {
  if (artist.release && !artist.release.title && !artist.release.link && !artist.release.cover) {
    artist.release = null;
  }

  if (artist.contact && !artist.contact.label && !artist.contact.url) {
    artist.contact = null;
  }
};

const setField = async (artist, field, rawValue, shouldClear) => {
  if (!editableFields.has(field)) {
    throw new Error(`Campo no editable: "${field}". Usa --help para ver campos disponibles.`);
  }

  const value = shouldClear ? '' : rawValue;

  if (field === 'photo') {
    artist.photo = shouldClear ? '' : await copyAsset(value, artist.slug, 'photo');
    return;
  }

  if (field === 'release.cover') {
    const release = ensureObject(artist, 'release');
    release.cover = shouldClear ? '' : await copyAsset(value, artist.slug, 'release');
    cleanupEmptyObjects(artist);
    return;
  }

  const parts = field.split('.');
  if (parts.length === 1) {
    artist[field] = value;
    return;
  }

  const [group, key] = parts;
  const groupValue = ensureObject(artist, group);
  groupValue[key] = value;
  cleanupEmptyObjects(artist);
};

try {
  const [, , rawSlug, field, ...valueParts] = process.argv;

  if (process.argv.includes('--help')) {
    usage();
    process.exit(0);
  }

  if (!rawSlug || !field || !valueParts.length) {
    usage();
    process.exit(1);
  }

  const slug = slugify(rawSlug);
  const shouldClear = valueParts.includes('--clear');
  const value = valueParts.filter(part => part !== '--clear').join(' ').trim();

  if (!slug) throw new Error('El slug no puede quedar vacio.');
  if (!shouldClear && !value) throw new Error('El valor no puede quedar vacio. Usa --clear para borrar un campo.');

  const data = await readFile('artist-data.json', 'utf8').then(JSON.parse);
  const artist = data.artists.find(item => item.slug === slug);

  if (!artist) {
    const existing = data.artists.map(item => item.slug).join(', ') || 'sin artistas';
    throw new Error(`No existe un artista con slug "${slug}". Slugs actuales: ${existing}`);
  }

  await setField(artist, field, value, shouldClear);
  await writeFile('artist-data.json', `${JSON.stringify(data, null, 2)}\n`);
  await execFileAsync('node', ['generate-artist.mjs', '--build']);

  console.log(`Artista actualizado: ${artist.name}`);
  console.log(`Campo: ${field}`);
  console.log('Roster, pagina del artista y sitemap.xml reconstruidos.');
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
}
