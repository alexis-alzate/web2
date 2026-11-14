import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '@/lib/errors';
import {
  RESERVED_SHORT_LINKS,
  buildShortLinkRedirects,
  validateShortLink,
  withShortLinkRedirects
} from '@/lib/artists/short-link';

const others = [
  { slug: 'siervo-john', shortLink: 'jhon' },
  { slug: 'evangelista-gonzalez', shortLink: null }
];

describe('validateShortLink', () => {
  it('vacio significa sin enlace corto', () => {
    expect(validateShortLink('', others)).toBeNull();
  });

  it('acepta un nombre limpio', () => {
    expect(validateShortLink('julian', others)).toBe('julian');
    expect(validateShortLink('julian-ramos-2', others)).toBe('julian-ramos-2');
  });

  it.each([
    ['muy corto', 'ab'],
    ['muy largo', 'a'.repeat(31)],
    ['con mayusculas', 'Julian'],
    ['con espacios', 'julian ramos'],
    ['con barra', 'julian/ramos'],
    ['con punto', 'julian.ramos'],
    ['guion al inicio', '-julian'],
    ['doble guion', 'julian--ramos'],
    ['comodin de ruta', ':path*'],
    ['parentesis de expresion regular', '(.*)']
  ])('rechaza el formato: %s', (_name, value) => {
    expect(() => validateShortLink(value, others)).toThrow(ValidationError);
  });

  it('rechaza los nombres reservados del sitio', () => {
    for (const name of ['artistas', 'lanzamientos', 'unete', 'assets', 'admin', 'tienda', 'api']) {
      expect(() => validateShortLink(name, others)).toThrow(ValidationError);
    }
  });

  it('rechaza el enlace corto o el slug de OTRO artista', () => {
    expect(() => validateShortLink('jhon', others)).toThrow(ConflictError);
    expect(() => validateShortLink('siervo-john', others)).toThrow(ConflictError);
  });

  // En Vercel una redireccion gana sobre los archivos: un enlace corto con el
  // nombre de una carpeta del sitio la dejaria inaccesible.
  it('toda carpeta de primer nivel del sitio esta reservada', () => {
    const root = resolve(__dirname, '../../');
    const folders = readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules')
      .map(entry => entry.name.toLowerCase());

    expect(folders.length).toBeGreaterThan(5);
    for (const folder of folders) {
      expect(RESERVED_SHORT_LINKS.has(folder), `falta reservar "${folder}"`).toBe(true);
    }
  });
});

describe('buildShortLinkRedirects', () => {
  it('crea dos redirecciones temporales por artista (con y sin barra final)', () => {
    expect(buildShortLinkRedirects([{ slug: 'la-libreta', shortLink: 'julian' }, { slug: 'ana' }])).toEqual([
      { source: '/julian', destination: '/artistas/la-libreta/', permanent: false },
      { source: '/julian/', destination: '/artistas/la-libreta/', permanent: false }
    ]);
  });

  it('nunca escribe una redireccion peligrosa aunque el dato venga danado', () => {
    expect(buildShortLinkRedirects([
      { slug: 'ana', shortLink: 'artistas' },
      { slug: 'beto', shortLink: '(.*)' },
      { slug: 'caro', shortLink: 'ok/../x' },
      { slug: 'Mal Slug', shortLink: 'bueno' },
      { slug: 'dani', shortLink: 'repetido' },
      { slug: 'edu', shortLink: 'repetido' }
    ])).toEqual([
      { source: '/repetido', destination: '/artistas/dani/', permanent: false },
      { source: '/repetido/', destination: '/artistas/dani/', permanent: false }
    ]);
  });
});

describe('withShortLinkRedirects', () => {
  const artists = [{ slug: 'la-libreta', shortLink: 'julian' }];

  it('parte de cero si no hay vercel.json', () => {
    expect(withShortLinkRedirects({}, artists)).toEqual({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      redirects: [
        { source: '/julian', destination: '/artistas/la-libreta/', permanent: false },
        { source: '/julian/', destination: '/artistas/la-libreta/', permanent: false }
      ]
    });
    expect(withShortLinkRedirects(null, []).redirects).toEqual([]);
    expect(withShortLinkRedirects(['raro'], []).redirects).toEqual([]);
  });

  it('conserva la configuracion y las redirecciones puestas a mano', () => {
    const manual = { source: '/promo', destination: 'https://tienda.lujourban.com/', permanent: true };
    const deep = { source: '/viejo/:path*', destination: '/artistas/:path*' };
    const config = withShortLinkRedirects({
      trailingSlash: true,
      headers: [{ source: '/(.*)', headers: [] }],
      redirects: [manual, deep, { source: '/viejo-alias', destination: '/artistas/la-libreta/', permanent: false }]
    }, artists);

    expect(config.trailingSlash).toBe(true);
    expect(config.headers).toEqual([{ source: '/(.*)', headers: [] }]);
    expect(config.redirects).toEqual([
      manual,
      deep,
      { source: '/julian', destination: '/artistas/la-libreta/', permanent: false },
      { source: '/julian/', destination: '/artistas/la-libreta/', permanent: false }
    ]);
  });

  it('quitar el enlace corto quita sus redirecciones', () => {
    const first = withShortLinkRedirects({}, artists);
    expect(withShortLinkRedirects(first, [{ slug: 'la-libreta', shortLink: null }]).redirects).toEqual([]);
  });

  it('es idempotente', () => {
    const first = withShortLinkRedirects({}, artists);
    expect(withShortLinkRedirects(first, artists)).toEqual(first);
  });
});
