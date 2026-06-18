import { slugify } from '@/lib/beats';

export const MB = 1024 * 1024;
export const MAX_TOTAL_UPLOAD_BYTES = 240 * MB;
export const MAX_FILE_BYTES = {
  cover: 12 * MB,
  preview: 60 * MB,
  basic: 80 * MB,
  premium: 180 * MB,
  exclusive: 220 * MB
};

export type UploadField = keyof typeof MAX_FILE_BYTES;

export type BeatUploadMetadata = {
  title: string;
  slug?: string;
  bpm?: string | number | null;
  key?: string | null;
  genre?: string | null;
  producer_id?: string | null;
  tags?: string | null;
  price_basic: string | number;
  price_premium: string | number;
  price_exclusive: string | number;
};

export type BeatUploadFileInput = {
  field: UploadField;
  name: string;
  size: number;
  type: string;
};

export type BeatStoragePath = {
  field: UploadField;
  bucket: string;
  path: string;
};

export const formatBytes = (value: number) => `${Math.round(value / MB)} MB`;

export const fileExtFromName = (fileName: string, fallback: string) => {
  const match = fileName.match(/\.[^.]+$/);
  return match ? match[0] : fallback;
};

export const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const normalizeBeatMetadata = (metadata: BeatUploadMetadata) => {
  const title = typeof metadata.title === 'string' ? metadata.title.trim() : '';
  if (!title) throw new Error('El titulo es obligatorio.');

  const slug = slugify((typeof metadata.slug === 'string' && metadata.slug.trim()) || title);
  if (!slug) throw new Error('No se pudo generar un slug valido.');

  const numberField = (value: unknown, field: string) => {
    const parsed = Number(value);
    if (value === undefined || value === null || value === '' || Number.isNaN(parsed)) {
      throw new Error(`El campo ${field} es invalido.`);
    }
    return parsed;
  };

  const optionalNumber = (value: unknown, field: string) => {
    if (value === undefined || value === null || value === '') return null;
    return numberField(value, field);
  };

  const tagsRaw = normalizeOptionalText(metadata.tags);

  return {
    title,
    slug,
    bpm: optionalNumber(metadata.bpm, 'bpm'),
    key: normalizeOptionalText(metadata.key),
    genre: normalizeOptionalText(metadata.genre),
    producer_id: normalizeOptionalText(metadata.producer_id),
    tags: tagsRaw ? tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean) : null,
    price_basic: numberField(metadata.price_basic, 'price_basic'),
    price_premium: numberField(metadata.price_premium, 'price_premium'),
    price_exclusive: numberField(metadata.price_exclusive, 'price_exclusive')
  };
};

export const storageTargetForUpload = (slug: string, file: BeatUploadFileInput): BeatStoragePath => {
  if (!(file.field in MAX_FILE_BYTES)) throw new Error('Tipo de archivo invalido.');

  if (file.field === 'cover') {
    return {
      field: file.field,
      bucket: 'beats-covers',
      path: `${slug}${fileExtFromName(file.name, '.jpg')}`
    };
  }

  if (file.field === 'preview') {
    return {
      field: file.field,
      bucket: 'beats-previews',
      path: `${slug}-preview${fileExtFromName(file.name, '.mp3')}`
    };
  }

  return {
    field: file.field,
    bucket: 'beats-files',
    path: `${slug}-${file.field}${fileExtFromName(file.name, '.zip')}`
  };
};

export const validateUploadFiles = (files: BeatUploadFileInput[]) => {
  const uploadTotal = files.reduce((sum, file) => sum + file.size, 0);
  if (uploadTotal > MAX_TOTAL_UPLOAD_BYTES) {
    throw new Error(`La subida total pesa ${formatBytes(uploadTotal)}. Maximo permitido por publicacion: ${formatBytes(MAX_TOTAL_UPLOAD_BYTES)}.`);
  }

  for (const file of files) {
    const maxBytes = MAX_FILE_BYTES[file.field];
    if (!maxBytes) throw new Error('Tipo de archivo invalido.');
    if (file.size > maxBytes) {
      throw new Error(`${file.name} pesa ${formatBytes(file.size)}. Maximo permitido: ${formatBytes(maxBytes)}.`);
    }
  }
};
