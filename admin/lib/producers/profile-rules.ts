// Reglas puras del perfil publico del productor. Aqui no hay Supabase ni Next.

import { ValidationError } from '@/lib/errors';

export const BIO_MAX_LENGTH = 160;

// Caracteres de control (menos el salto de linea, que se trata aparte).
const CONTROL_CHARS = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

// Descripcion corta: una sola linea, sin espacios de mas. Vacia = sin descripcion.
// Se mide en caracteres (no en bytes), igual que el limite de la base.
export const parseBio = (raw: string | null | undefined): string | null => {
  const clean = String(raw ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;

  const length = Array.from(clean).length;
  if (length > BIO_MAX_LENGTH) {
    throw new ValidationError(`La descripción puede tener hasta ${BIO_MAX_LENGTH} caracteres. Tiene ${length}.`);
  }
  return clean;
};

// Misma forma que exige la base en `producers.photo_path`.
export const PRODUCER_PHOTO_PATH =
  /^productores\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/foto-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const isProducerPhotoPath = (value: string) => PRODUCER_PHOTO_PATH.test(value);

// Una foto solo puede borrarse si es de ESE productor: evita que una ruta
// ajena (de otro productor o de un beat) llegue al borrado.
export const ownsPhotoPath = (producerId: string, path: string) =>
  isProducerPhotoPath(path) && path.startsWith(`productores/${producerId}/`);
