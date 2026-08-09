export const SOCIAL_KEYS = [
  'tiktok',
  'spotify',
  'instagram',
  'youtube',
  'facebook',
  'whatsapp'
] as const;

export type SocialKey = (typeof SOCIAL_KEYS)[number];

export const SOCIAL_LABELS: Record<SocialKey, string> = {
  tiktok: 'TikTok',
  spotify: 'Spotify',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp'
};

export const DEFAULT_SOCIAL_ORDER: SocialKey[] = [...SOCIAL_KEYS];

const isSocialKey = (value: string): value is SocialKey =>
  (SOCIAL_KEYS as readonly string[]).includes(value);

export const normalizeSocialOrder = (order?: readonly string[] | null): SocialKey[] => {
  const normalized = (order || []).filter(isSocialKey);
  return Array.from(new Set([...normalized, ...DEFAULT_SOCIAL_ORDER]));
};

export const parseSocialOrder = (value: FormDataEntryValue | null) =>
  normalizeSocialOrder(String(value || '').split(',').map(item => item.trim()).filter(Boolean));
