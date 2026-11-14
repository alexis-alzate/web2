// QR de la pagina de un artista: reglas, sin red, sin Next y sin librerias.
// Quien dibuja es un `QrRenderer` que llega por parametro (ver lib/qr), asi
// estas reglas se prueban con un doble en memoria.
//
// Capas:
//   app/api/portal/qr/route.ts   controlador: sesion, lee la peticion, responde
//   lib/artist-qr.ts             reglas: formato, destino permitido, nombre
//   lib/qr/renderer.ts           dibujo: unico que conoce la libreria

import { ValidationError } from '@/lib/errors';
import type { QrRenderer } from '@/lib/qr/renderer';

export const QR_FORMATS = ['png', 'svg'] as const;
export type QrFormat = (typeof QR_FORMATS)[number];

// Ruta que sirve el QR. La usan la ruta y la pantalla del portal: un solo
// lugar para que no se desalineen.
export const QR_PATH = '/api/portal/qr';

export const qrPath = (format: QrFormat, download = false): string =>
  `${QR_PATH}?formato=${format}${download ? '&descargar=1' : ''}`;

const CONTENT_TYPES: Record<QrFormat, string> = {
  png: 'image/png',
  svg: 'image/svg+xml; charset=utf-8'
};

// El QR solo puede llevar a nuestro sitio: aunque algun dato de un artista
// estuviera mal, nunca se imprime un codigo que mande a otra parte.
const ALLOWED_HOSTS = new Set(['www.lujourban.com', 'lujourban.com']);
const MAX_TARGET_LENGTH = 200;

// Sin formato = PNG (lo que mas se usa). Un formato desconocido es un error:
// no se adivina.
export const parseQrFormat = (raw: string | null | undefined): QrFormat => {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return 'png';
  if ((QR_FORMATS as readonly string[]).includes(value)) return value as QrFormat;
  throw new ValidationError('Elige el formato PNG o SVG.');
};

export const assertQrTarget = (url: string): string => {
  const invalid = () => new ValidationError('No pudimos preparar el QR de tu página.');
  if (!url || url.length > MAX_TARGET_LENGTH) throw invalid();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw invalid();
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) throw invalid();
  return parsed.toString();
};

// Nombre del archivo descargado. El slug ya viene validado, pero este valor
// va en una cabecera HTTP: se limpia igual.
export const qrFileName = (slug: string, format: QrFormat): string => {
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'artista';
  return `qr-${safe}.${format}`;
};

export type ArtistQr = {
  fileName: string;
  contentType: string;
  body: string | Uint8Array;
};

export const createArtistQr = async (
  input: { slug: string; url: string; format: QrFormat },
  renderer: QrRenderer
): Promise<ArtistQr> => {
  const target = assertQrTarget(input.url);
  const body = input.format === 'svg' ? await renderer.svg(target) : await renderer.png(target);
  return {
    fileName: qrFileName(input.slug, input.format),
    contentType: CONTENT_TYPES[input.format],
    body
  };
};
