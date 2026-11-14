// Enlace corto del artista: www.lujourban.com/<enlace> -> /artistas/<slug>/.
//
// Aqui viven las reglas (que nombre es valido) y la traduccion a
// redirecciones de Vercel. Todo es puro y tiene pruebas.
//
// OJO: en Vercel una redireccion gana sobre los archivos del sitio. Un enlace
// corto llamado "artistas" secuestraria www.lujourban.com/artistas. Por eso
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

export type VercelRedirect = {
  source: string;
  destination: string;
  permanent?: boolean;
  [key: string]: unknown;
};

export type VercelConfig = {
  redirects?: VercelRedirect[];
  [key: string]: unknown;
};

const ARTIST_DESTINATION = /^\/artistas\/[a-z0-9-]+\/$/;
const SINGLE_SEGMENT_SOURCE = /^\/[a-z0-9-]+\/?$/;

// Una redireccion es "nuestra" si lleva de un solo segmento a la pagina de
// un artista. Las demas (puestas a mano) se respetan tal cual.
const isShortLinkRedirect = (redirect: VercelRedirect) =>
  typeof redirect?.source === 'string'
  && typeof redirect?.destination === 'string'
  && SINGLE_SEGMENT_SOURCE.test(redirect.source)
  && ARTIST_DESTINATION.test(redirect.destination);

// Dos entradas por artista (con y sin barra final). Temporal (307) para que
// cambiar o quitar un enlace corto no quede pegado en la cache del navegador.
// Vercel conserva los parametros de la URL (?utm_source=...) y el navegador
// conserva el sitio de origen, asi las estadisticas siguen viendo de donde
// llego la visita.
export const buildShortLinkRedirects = (artists: ShortLinkOwner[]): VercelRedirect[] => {
  const seen = new Set<string>();
  return artists.flatMap(artist => {
    const shortLink = artist.shortLink ?? '';
    // Defensa extra: un vercel.json invalido tumbaria el despliegue del sitio.
    if (!isValidShortLinkFormat(shortLink) || RESERVED_SHORT_LINKS.has(shortLink) || seen.has(shortLink)) return [];
    if (!SHORT_LINK_PATTERN.test(artist.slug)) return [];
    seen.add(shortLink);

    const destination = `/artistas/${artist.slug}/`;
    return [
      { source: `/${shortLink}`, destination, permanent: false },
      { source: `/${shortLink}/`, destination, permanent: false }
    ];
  });
};

// Devuelve el vercel.json con las redirecciones de enlaces cortos al dia.
// Conserva cualquier otra configuracion o redireccion que ya tuviera.
export const withShortLinkRedirects = (current: unknown, artists: ShortLinkOwner[]): VercelConfig => {
  const config: VercelConfig = current && typeof current === 'object' && !Array.isArray(current)
    ? { ...(current as VercelConfig) }
    : {};
  const manual = Array.isArray(config.redirects)
    ? config.redirects.filter(redirect => !isShortLinkRedirect(redirect))
    : [];

  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    ...config,
    redirects: [...manual, ...buildShortLinkRedirects(artists)]
  };
};
