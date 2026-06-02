import { readFile, writeFile } from 'node:fs/promises';

const scriptPath = new URL('./script.js', import.meta.url);
const script = await readFile(scriptPath, 'utf8');
const pattern = /showVipCommunity: (true|false)/;
const match = script.match(pattern);

if (!match) {
  throw new Error('No se encontro la configuracion showVipCommunity en script.js.');
}

const nextValue = match[1] === 'true' ? 'false' : 'true';
await writeFile(scriptPath, script.replace(pattern, `showVipCommunity: ${nextValue}`));

console.log(nextValue === 'true'
  ? 'Comunidad VIP activada.'
  : 'Comunidad VIP ocultada.');
