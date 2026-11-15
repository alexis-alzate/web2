#!/usr/bin/env node
// Respaldo de la base de LUJO URBAN: baja cada tabla de `public` a un archivo
// JSON dentro de `respaldos/AAAA-MM-DD_HHMM/` y lista los archivos de cada
// bucket de Storage.
//
// Uso (desde la raiz del repo):
//   node supabase/respaldo.mjs
//
// Lee NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY del entorno o, si no
// estan, de `admin/.env.local`. No instala nada: usa solo Node 18 o superior.
//
// IMPORTANTE
//   - Los archivos de respaldo traen correos de compradores y tokens de
//     descarga. La carpeta `respaldos/` esta en .gitignore: NUNCA subirla a
//     GitHub ni compartirla.
//   - Solo respalda LAS TABLAS y la LISTA de archivos. Los archivos en si (los
//     beats en el bucket privado `beats-files`) NO se copian aqui: son lo mas
//     valioso, copialos aparte (ver CONTRIBUTING / PRUEBA-DE-EXTREMO-A-EXTREMO.md).
//   - Es de solo lectura: no modifica nada en Supabase.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 1000;

// Tabla -> columna para ordenar (paginar sin orden estable repetiria o
// saltaria filas). `null` = tabla sin columna estable; se pide una sola pagina
// y se avisa si llega al limite.
const TABLES = {
  app_settings: 'key',
  artist_access: 'created_at',
  artist_link_clicks: 'id',
  artist_links: null,
  artist_releases: 'id',
  artist_waitlist: 'id',
  artists: 'id',
  beat_offers: 'id',
  beats: 'id',
  downloads: 'id',
  order_items: 'id',
  orders: 'id',
  portal_activity_events: 'id',
  portal_sessions: 'id',
  producer_applications: 'id',
  producer_earnings: 'id',
  producers: 'id',
  release_events: 'id'
};

const BUCKETS = ['beats-covers', 'beats-previews', 'beats-files'];

const readEnvFile = async () => {
  const file = path.join(ROOT, 'admin', '.env.local');
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of (await readFile(file, 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
};

const fail = message => {
  console.error(`\nERROR: ${message}`);
  process.exit(1);
};

const fromEnv = async () => {
  const file = await readEnvFile();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || file.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || file.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) fail('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (ni en el entorno ni en admin/.env.local).');
  return { url, key };
};

const headers = key => ({ apikey: key, Authorization: `Bearer ${key}` });

// Baja una tabla completa, pagina por pagina, y comprueba que la cantidad
// bajada coincida con la que informa la base.
const dumpTable = async ({ url, key }, table, orderBy) => {
  const rows = [];
  let total = null;

  for (let from = 0; ; from += PAGE) {
    const query = `select=*${orderBy ? `&order=${orderBy}.asc` : ''}`;
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: { ...headers(key), Range: `${from}-${from + PAGE - 1}`, Prefer: 'count=exact' }
    });
    if (!response.ok) throw new Error(`${table}: ${response.status} ${(await response.text()).slice(0, 200)}`);

    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`${table}: respuesta inesperada`);
    rows.push(...page);

    const range = response.headers.get('content-range') || '';
    const reported = Number(range.split('/')[1]);
    if (Number.isFinite(reported)) total = reported;

    if (page.length < PAGE) break;
    if (!orderBy) throw new Error(`${table}: tiene mas de ${PAGE} filas y no hay columna para ordenar. Agregala en TABLES.`);
  }

  if (total !== null && total !== rows.length) {
    throw new Error(`${table}: la base dice ${total} filas pero se bajaron ${rows.length}.`);
  }
  return rows;
};

// Lista TODOS los archivos de un bucket (recursivo por carpetas).
const listBucket = async ({ url, key }, bucket) => {
  const files = [];
  const walk = async prefix => {
    for (let offset = 0; ; offset += PAGE) {
      const response = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: { ...headers(key), 'content-type': 'application/json' },
        body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } })
      });
      if (!response.ok) throw new Error(`bucket ${bucket}: ${response.status} ${(await response.text()).slice(0, 200)}`);
      const page = await response.json();
      for (const item of page) {
        const full = prefix ? `${prefix}/${item.name}` : item.name;
        // Las carpetas vienen sin `id`.
        if (item.id) files.push({ path: full, bytes: item.metadata?.size ?? null, updated_at: item.updated_at ?? null });
        else await walk(full);
      }
      if (page.length < PAGE) break;
    }
  };
  await walk('');
  return files;
};

const stamp = () => {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
};

const main = async () => {
  const connection = await fromEnv();
  const folder = path.join(ROOT, 'respaldos', stamp());
  await mkdir(folder, { recursive: true });

  const summary = { creado: new Date().toISOString(), tablas: {}, buckets: {}, errores: [] };

  for (const [table, orderBy] of Object.entries(TABLES)) {
    try {
      const rows = await dumpTable(connection, table, orderBy);
      await writeFile(path.join(folder, `${table}.json`), JSON.stringify(rows, null, 2));
      summary.tablas[table] = rows.length;
      console.log(`ok   ${table}: ${rows.length} filas`);
    } catch (error) {
      summary.errores.push(error.message);
      console.error(`FALLO ${error.message}`);
    }
  }

  for (const bucket of BUCKETS) {
    try {
      const files = await listBucket(connection, bucket);
      await writeFile(path.join(folder, `storage_${bucket}.json`), JSON.stringify(files, null, 2));
      summary.buckets[bucket] = files.length;
      console.log(`ok   bucket ${bucket}: ${files.length} archivos (solo la lista)`);
    } catch (error) {
      summary.errores.push(error.message);
      console.error(`FALLO ${error.message}`);
    }
  }

  await writeFile(path.join(folder, 'resumen.json'), JSON.stringify(summary, null, 2));
  console.log(`\nRespaldo en: ${folder}`);
  if (summary.errores.length > 0) {
    console.error(`Con ${summary.errores.length} error(es): el respaldo esta INCOMPLETO. Revisalo antes de confiar en el.`);
    process.exit(2);
  }
  console.log('Completo. Guardalo fuera de este computador (nube privada o disco externo). No lo subas a GitHub.');
};

main().catch(error => fail(error.message));
