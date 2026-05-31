import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });

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
  const [{ releases }, scriptSource, htmlSource] = await Promise.all([
    readFile('release-history.json', 'utf8').then(JSON.parse),
    readFile('script.js', 'utf8'),
    readFile('index.html', 'utf8')
  ]);

  if (!releases.length) throw new Error('No hay lanzamientos guardados.');

  console.log('Lanzamientos disponibles:\n');
  releases.forEach((release, index) => console.log(`${index + 1}. ${release.title}`));

  const answer = (await rl.question('\nEscribe el numero que quieres activar: ')).trim();
  const selected = releases[Number(answer) - 1];
  if (!selected) throw new Error('La opcion no es valida.');

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
  title: ${JSON.stringify(selected.title)},
  trackingTitle: ${JSON.stringify(selected.title)},
  slug: ${JSON.stringify(selected.slug)},
  artist: 'ZAETTA',
  cover: ${JSON.stringify(selected.cover)},
  link: ${JSON.stringify(selected.link)},
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

  console.log(`\n${selected.title} quedo activo nuevamente.`);
  if (selected.shareUrl) console.log(`Enlace para compartir: ${selected.shareUrl}`);
  console.log('\nAhora publica con:');
  console.log('./publicar.sh');
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
