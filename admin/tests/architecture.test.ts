import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Hace cumplir la regla de carpetas de AGENTS.md ("Donde va cada cosa en admin/"):
//   frontend/ -> puede importar de shared/ y de si misma (NUNCA valores de backend/)
//   backend/  -> puede importar de shared/ y de si misma (NUNCA de frontend/)
//   shared/   -> no importa de frontend/ ni de backend/
// Un `import type` de backend/ en frontend/ esta permitido: se borra al compilar y
// no arrastra codigo ni secretos del servidor al navegador.

const adminRoot = resolve(__dirname, '..');

const listSources = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listSources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });

type Import = { file: string; spec: string; typeOnly: boolean };

const importsOf = (layer: string): Import[] =>
  listSources(join(adminRoot, layer)).flatMap(file => {
    const text = readFileSync(file, 'utf8');
    const found: Import[] = [];
    const re = /(^|\n)\s*(import|export)\s+(type\s+)?([^'"]*?\sfrom\s+)?(['"])([^'"]+)\5/g;
    for (const match of text.matchAll(re)) {
      found.push({
        file: relative(adminRoot, file).split(sep).join('/'),
        spec: match[6],
        typeOnly: Boolean(match[3])
      });
    }
    return found;
  });

const offenders = (layer: string, forbidden: string[], allowTypeOnly: boolean) =>
  importsOf(layer)
    .filter(item => forbidden.some(prefix => item.spec.startsWith(`@/${prefix}/`)))
    .filter(item => !(allowTypeOnly && item.typeOnly))
    .map(item => `${item.file} importa ${item.spec}`);

describe('arquitectura de carpetas de admin/', () => {
  it('frontend/ no importa valores de backend/ (solo "import type")', () => {
    expect(offenders('frontend', ['backend'], true)).toEqual([]);
  });

  it('backend/ no importa de frontend/', () => {
    expect(offenders('backend', ['frontend'], false)).toEqual([]);
  });

  it('shared/ no importa de frontend/ ni de backend/', () => {
    expect(offenders('shared', ['frontend', 'backend'], false)).toEqual([]);
  });

  it('nadie usa rutas relativas que salgan de su capa', () => {
    const escapes = ['frontend', 'backend', 'shared'].flatMap(layer =>
      importsOf(layer)
        .filter(item => item.spec.startsWith('../../'))
        .map(item => `${item.file} importa ${item.spec} (usar alias "@/")`)
    );
    expect(escapes).toEqual([]);
  });
});
