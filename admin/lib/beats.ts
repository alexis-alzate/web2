export type LicenseType = 'basic' | 'premium' | 'exclusive';

export type Beat = {
  id: string;
  slug: string;
  title: string;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  tags: string[] | null;
  cover_url: string | null;
  preview_url: string | null;
  price_basic: number;
  price_premium: number;
  price_exclusive: number;
  file_basic_path: string | null;
  file_premium_path: string | null;
  file_exclusive_path: string | null;
  status: 'available' | 'sold_exclusive';
  created_at: string;
};

export const LICENSE_LABELS: Record<LicenseType, { name: string }> = {
  basic: { name: 'Básica' },
  premium: { name: 'Premium' },
  exclusive: { name: 'Exclusiva' }
};

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const beatCoverUrl = (path: string | null) => {
  if (!path) return '';
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/beats-covers/${path}`;
};
