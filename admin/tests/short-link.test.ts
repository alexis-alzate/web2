import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConflictError, ValidationError } from '@/lib/errors';
import {
  RESERVED_SHORT_LINKS,
  buildShortLinkRewrites,
  validateShortLink,
  withShortLinkRoutes
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

  // Un enlace corto con el nombre de una carpeta del sitio podria taparla.
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

describe('buildShortLinkRewrites', () => {
  it('crea dos reglas por artista (con y sin barra final) hacia su pagina', () => {
    expect(buildShortLinkRewrites([{ slug: 'la-libreta', shortLink: 'julianramos' }, { slug: 'ana' }])).toEqual([
      { source: '/julianramos', destination: '/artistas/la-libreta/index.html' },
      { source: '/julianramos/', destination: '/artistas/la-libreta/index.html' }
    ]);
  });

  it('nunca escribe una regla peligrosa aunque el dato venga danado', () => {
    expect(buildShortLinkRewrites([
      { slug: 'ana', shortLink: 'artistas' },
      { slug: 'beto', shortLink: '(.*)' },
      { slug: 'caro', shortLink: 'ok/../x' },
      { slug: 'Mal Slug', shortLink: 'bueno' },
      { slug: 'dani', shortLink: 'repetido' },
      { slug: 'edu', shortLink: 'repetido' }
    ])).toEqual([
      { source: '/repetido', destination: '/artistas/dani/index.html' },
      { source: '/repetido/', destination: '/artistas/dani/index.html' }
    ]);
  });
});

describe('withShortLinkRoutes', () => {
  const artists = [{ slug: 'la-libreta', shortLink: 'julianramos' }];
  const ours = [
    { source: '/julianramos', destination: '/artistas/la-libreta/index.html' },
    { source: '/julianramos/', destination: '/artistas/la-libreta/index.html' }
  ];

  it('parte de cero si no hay vercel.json', () => {
    expect(withShortLinkRoutes({}, artists)).toEqual({
      $schema: 'https://openapi.vercel.sh/vercel.json',
      redirects: [],
      rewrites: ours
    });
    expect(withShortLinkRoutes(null, []).rewrites).toEqual([]);
    expect(withShortLinkRoutes(['raro'], []).rewrites).toEqual([]);
  });

  it('retira las redirecciones de la primera version de los enlaces cortos', () => {
    const config = withShortLinkRoutes({
      redirects: [
        { source: '/julianramos', destination: '/artistas/la-libreta/', permanent: false },
        { source: '/julianramos/', destination: '/artistas/la-libreta/', permanent: false }
      ]
    }, artists);

    expect(config.redirects).toEqual([]);
    expect(config.rewrites).toEqual(ours);
  });

  it('conserva la configuracion y las reglas puestas a mano', () => {
    const manualRedirect = { source: '/promo', destination: 'https://tienda.lujourban.com/', permanent: true };
    const deepRedirect = { source: '/viejo/:path*', destination: '/artistas/:path*' };
    const manualRewrite = { source: '/api/:path*', destination: 'https://admin.lujourban.com/api/:path*' };
    const config = withShortLinkRoutes({
      trailingSlash: true,
      headers: [{ source: '/(.*)', headers: [] }],
      redirects: [manualRedirect, deepRedirect],
      rewrites: [manualRewrite, { source: '/viejo-alias', destination: '/artistas/la-libreta/index.html' }]
    }, artists);

    expect(config.trailingSlash).toBe(true);
    expect(config.headers).toEqual([{ source: '/(.*)', headers: [] }]);
    expect(config.redirects).toEqual([manualRedirect, deepRedirect]);
    expect(config.rewrites).toEqual([manualRewrite, ...ours]);
  });

  it('quitar el enlace corto quita sus reglas', () => {
    const first = withShortLinkRoutes({}, artists);
    expect(withShortLinkRoutes(first, [{ slug: 'la-libreta', shortLink: null }]).rewrites).toEqual([]);
  });

  it('es idempotente', () => {
    const first = withShortLinkRoutes({}, artists);
    expect(withShortLinkRoutes(first, artists)).toEqual(first);
  });
});
