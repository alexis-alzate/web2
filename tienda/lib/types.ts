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

export const LICENSE_LABELS: Record<LicenseType, { name: string; desc: string }> = {
  basic: { name: 'Básica', desc: 'MP3, uso no exclusivo' },
  premium: { name: 'Premium', desc: 'WAV, uso no exclusivo' },
  exclusive: { name: 'Ilimitada', desc: 'WAV + stems, uso no exclusivo' }
};

export const priceForLicense = (beat: Beat, license: LicenseType) => {
  if (license === 'basic') return beat.price_basic;
  if (license === 'premium') return beat.price_premium;
  return beat.price_exclusive;
};

export const filePathForLicense = (beat: Beat, license: LicenseType) => {
  if (license === 'basic') return beat.file_basic_path;
  if (license === 'premium') return beat.file_premium_path;
  return beat.file_exclusive_path;
};
