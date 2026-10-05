export const SOCIAL_KEYS = [
  'tiktok',
  'spotify',
  'instagram',
  'youtube',
  'facebook',
  'whatsapp'
] as const;

export type SocialKey = (typeof SOCIAL_KEYS)[number];

export type HeroButtonPreferences = {
  primary?: SocialKey;
  secondary?: SocialKey;
};

export const SOCIAL_LABELS: Record<SocialKey, string> = {
  tiktok: 'TikTok',
  spotify: 'Spotify',
  instagram: 'Instagram',
  youtube: 'YouTube',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp'
};

export const DEFAULT_SOCIAL_ORDER: SocialKey[] = [...SOCIAL_KEYS];

export const isSocialKey = (value: string): value is SocialKey =>
  (SOCIAL_KEYS as readonly string[]).includes(value);

export const normalizeSocialOrder = (order?: readonly string[] | null): SocialKey[] => {
  const normalized = (order || []).filter(isSocialKey);
  return Array.from(new Set([...normalized, ...DEFAULT_SOCIAL_ORDER]));
};

export const parseSocialOrder = (value: FormDataEntryValue | null) =>
  normalizeSocialOrder(String(value || '').split(',').map(item => item.trim()).filter(Boolean));

export const resolveHeroButtons = (
  links?: Record<string, string> | null,
  preferences?: HeroButtonPreferences | null
): HeroButtonPreferences => {
  const available = SOCIAL_KEYS.filter(key => Boolean(links?.[key]?.trim()));
  const hasLink = (key?: SocialKey): key is SocialKey => Boolean(key && available.includes(key));

  const preferredPrimary = hasLink(preferences?.primary) ? preferences.primary : undefined;
  const preferredSecondary = hasLink(preferences?.secondary) ? preferences.secondary : undefined;

  let primary = preferredPrimary;
  if (!primary) {
    const automaticPrimary = hasLink('spotify') ? 'spotify' : available[0];
    primary = automaticPrimary === preferredSecondary
      ? available.find(key => key !== preferredSecondary) || automaticPrimary
      : automaticPrimary;
  }

  let secondary = preferredSecondary && preferredSecondary !== primary
    ? preferredSecondary
    : undefined;

  if (!secondary) {
    secondary = hasLink('tiktok') && primary !== 'tiktok'
      ? 'tiktok'
      : available.find(key => key !== primary);
  }

  return { primary, secondary };
};
