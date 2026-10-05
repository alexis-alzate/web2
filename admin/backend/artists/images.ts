// Entrada de imagenes para artistas: archivos subidos desde un formulario y
// portadas que se descargan de un smart link (Hypeddit, too.fm, etc.).
//
// Solo se aceptan jpg, png y webp de hasta 5 MB. La base de datos tambien
// exige esas extensiones en photo_path, asi que rechazar aqui da un mensaje
// claro en vez de un error de constraint mas adelante.

import { ValidationError } from '@/backend/core/errors';

export type UploadedImage = {
  extension: 'jpg' | 'png' | 'webp';
  contentBase64: string;
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, UploadedImage['extension']> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const extensionFor = (mime: string) => EXTENSION_BY_MIME[mime.split(';')[0].trim().toLowerCase()] ?? null;

export const readUploadedImage = async (formData: FormData, field: string): Promise<UploadedImage | null> => {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return null;

  const extension = extensionFor(file.type);
  if (!extension) throw new ValidationError('La imagen debe ser JPG, PNG o WebP.');
  if (file.size > MAX_IMAGE_BYTES) throw new ValidationError('La imagen pesa mas de 5 MB. Usa una mas liviana.');

  return { extension, contentBase64: Buffer.from(await file.arrayBuffer()).toString('base64') };
};

const BROWSER_HEADERS = { 'user-agent': 'Mozilla/5.0 (compatible; LUJO-URBAN-Admin/1.0)' };

const readMetaAttribute = (tag: string, name: string) =>
  tag.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'))?.[1] || '';

const extractOgImage = (html: string, sourceUrl: string) => {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];

  for (const tag of tags) {
    const property = readMetaAttribute(tag, 'property') || readMetaAttribute(tag, 'name');
    if (!['og:image', 'og:image:secure_url', 'twitter:image'].includes(property.toLowerCase())) continue;

    const content = readMetaAttribute(tag, 'content');
    if (!content) continue;
    return new URL(content, sourceUrl).toString();
  }

  return '';
};

// Intenta sacar la portada (og:image) de un smart link. Si no se puede por
// cualquier motivo devuelve null: el lanzamiento se crea igual, sin portada.
export const fetchSmartLinkCover = async (smartLink: string): Promise<UploadedImage | null> => {
  try {
    const pageResponse = await fetch(smartLink, { headers: BROWSER_HEADERS, redirect: 'follow' });
    if (!pageResponse.ok) return null;

    const imageUrl = extractOgImage(await pageResponse.text(), pageResponse.url || smartLink);
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return null;

    const imageResponse = await fetch(imageUrl, { headers: BROWSER_HEADERS, redirect: 'follow' });
    if (!imageResponse.ok) return null;

    const extension = extensionFor(imageResponse.headers.get('content-type') || '');
    if (!extension) return null;

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;

    return { extension, contentBase64: buffer.toString('base64') };
  } catch {
    return null;
  }
};
