// Enlace corto del artista: www.lujourban.com/<enlace> muestra la pagina de
// /artistas/<slug>/ sin cambiar la direccion.
//
// Aqui viven las reglas (que nombre es valido) y la traduccion a reglas de
// Vercel (rewrites). Todo es puro y tiene pruebas.
//
// OJO: un enlace corto nunca debe llamarse igual que una carpeta del sitio
// ("artistas", "unete"...): segun el tipo de regla, Vercel podria servir la
// pagina del artista en lugar de esa carpeta. Por eso
// RESERVED_SHORT_LINKS debe incluir toda carpeta de primer nivel del sitio
// (hay una prueba que lo comprueba contra el repo).

import { ConflictError, ValidationError } from '@/lib/errors';

export const SHORT_LINK_MIN_LENGTH = 3;
export const SHORT_LINK_MAX_LENGTH = 30;

const SHORT_LINK_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const RESERVED_SHORT_LINKS: ReadonlySet<string> = new Set([
  // Carpetas y paginas que ya existen en el sitio.
  'artistas', 'lanzamientos', 'servicios', 'estados', 'unete', 'assets',
  'admin', 'tienda', 'supabase', 'lujourban-vision', 'comandos-lanzamientos',
  // Nombres que el sitio o la plataforma pueden necesitar despues.
  'api', 'casa', 'panel', 'www', 'index', 'inicio', 'home', 'login', 'beats',
  'tienda-beats', 'contacto', 'blog', 'ayuda', 'soporte', 'legal', 'terminos',
  'privacidad', 'precios', 'planes', 'mi-perfil', 'static', 'public',
  'vercel', 'well-known', 'favicon', 'robots', 'sitemap', 'script', 'styles',
  'lujo-urban', 'lujourban'
]);

export const isValidShortLinkFormat = (value: string) =>
  SHORT_LINK_PATTERN.test(value)
  && value.length >= SHORT_LINK_MIN_LENGTH
  && value.length <= SHORT_LINK_MAX_LENGTH;

type ShortLinkOwner = { slug: string; shortLink?: string | null };

// Valida el enlace corto que el admin escribio (ya normalizado a minusculas
// y guiones). `others` son los DEMAS artistas, sin el que se esta guardando.
// Devuelve null si viene vacio (= sin enlace corto).
export const validateShortLink = (value: string, others: ShortLinkOwner[]): string | null => {
  if (!value) return null;

  if (!isValidShortLinkFormat(value)) {
    throw new ValidationError(
      `El enlace corto debe tener entre ${SHORT_LINK_MIN_LENGTH} y ${SHORT_LINK_MAX_LENGTH} caracteres: solo letras, numeros y guiones.`
    );
  }
  if (RESERVED_SHORT_LINKS.has(value)) {
    throw new ValidationError(`"${value}" es un nombre reservado del sitio. Elige otro enlace corto.`);
  }
  if (others.some(other => other.shortLink === value)) {
    throw new ConflictError('Otro artista ya usa ese enlace corto.');
  }
  if (others.some(other => other.slug === value)) {
    throw new ConflictError('Ese enlace corto es el slug de otro artista. Elige otro para no confundirlos.');
  }
  return value;
};

export type VercelRoute = {
  source: string;
  destination: string;
  permanent?: boolean;
  [key: string]: unknown;
};

export type VercelConfig = {
  redirects?: VercelRoute[];
  rewrites?: VercelRoute[];
  [key: string]: unknown;
};

// Con o sin index.html: la primera version de los enlaces cortos redirigia a
// /artistas/<slug>/; la actual sirve /artistas/<slug>/index.html.
const ARTIST_DESTINATION = /^\/artistas\/[a-z0-9-]+\/(index\.html)?$/;
const SINGLE_SEGMENT_SOURCE = /^\/[a-z0-9-]+\/?$/;

// Una regla es "nuestra" si lleva de un solo segmento a la pagina de un
// artista. Las demas (puestas a mano) se respetan tal cual.
const isShortLinkRoute = (route: VercelRoute) =>
  typeof route?.source === 'string'
  && typeof route?.destination === 'string'
  && SINGLE_SEGMENT_SOURCE.test(route.source)
  && ARTIST_DESTINATION.test(route.destination);

// Dos reglas por artista (con y sin barra final). Son "rewrites": Vercel
// entrega la pagina del artista SIN cambiar la direccion, asi la barra del
// navegador sigue mostrando www.lujourban.com/<enlace>. Por eso la pagina
// del artista usa rutas que empiezan en "/" para estilos e imagenes.
export const buildShortLinkRewrites = (artists: ShortLinkOwner[]): VercelRoute[] => {
  const seen = new Set<string>();
  return artists.flatMap(artist => {
    const shortLink = artist.shortLink ?? '';
    // Defensa extra: un vercel.json invalido tumbaria el despliegue del sitio.
    if (!isValidShortLinkFormat(shortLink) || RESERVED_SHORT_LINKS.has(shortLink) || seen.has(shortLink)) return [];
    if (!SHORT_LINK_PATTERN.test(artist.slug)) return [];
    seen.add(shortLink);

    const destination = `/artistas/${artist.slug}/index.html`;
    return [
      { source: `/${shortLink}`, destination },
      { source: `/${shortLink}/`, destination }
    ];
  });
};

// Devuelve el vercel.json con las reglas de enlaces cortos al dia. Conserva
// cualquier otra configuracion, redireccion o rewrite que ya tuviera, y
// retira las redirecciones de enlaces cortos de la primera version.
export const withShortLinkRoutes = (current: unknown, artists: ShortLinkOwner[]): VercelConfig => {
  const config: VercelConfig = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...(current as VercelConfig) }
    : {};
  const manual = (routes: unknown) =>
    Array.isArray(routes) ? (routes as VercelRoute[]).filter(route => !isShortLinkRoute(route)) : [];

  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    ...config,
    redirects: manual(config.redirects),
    rewrites: [...manual(config.rewrites), ...buildShortLinkRewrites(artists)]
  };
};
