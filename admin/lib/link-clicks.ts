// Clics en los enlaces del artista (botones de arriba y cuadricula de redes).
//
// Aqui viven las reglas: que es un clic valido y como se resume para el
// portal. El endpoint (app/api/analytics/link-click/route.ts) solo lee la
// peticion y guarda. Todo lo de este archivo es puro y tiene pruebas.

import { ValidationError } from '@/lib/errors';
import { SOCIAL_KEYS, SOCIAL_LABELS, isSocialKey, type SocialKey } from '@/lib/socials';

export const LINK_PLACEMENTS = ['hero', 'grid'] as const;
export type LinkPlacement = (typeof LINK_PLACEMENTS)[number];

const DEVICE_TYPES = ['mobile', 'tablet', 'desktop'] as const;
type DeviceType = (typeof DEVICE_TYPES)[number];

// El mismo formato que exige la tabla artists.
const ARTIST_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 90;
const MAX_USER_AGENT_LENGTH = 300;

export type LinkClickRow = {
  artist_slug: string;
  link_key: SocialKey;
  placement: LinkPlacement;
  device_type: DeviceType;
  user_agent: string;
};

const text = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const detectDevice = (userAgent: string): DeviceType => {
  const value = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook/.test(value)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(value)) return 'mobile';
  return 'desktop';
};

// Valida lo que manda la pagina publica. Solo acepta valores de listas
// cerradas: no se guarda ningun texto libre del visitante salvo el
// user-agent (recortado), que se usa para no contar dos veces un doble toque.
export const parseLinkClick = (payload: unknown, userAgentHeader: string | null): LinkClickRow => {
  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};

  const artistSlug = text(body.artist_slug, MAX_SLUG_LENGTH + 1);
  if (!artistSlug || artistSlug.length > MAX_SLUG_LENGTH || !ARTIST_SLUG_PATTERN.test(artistSlug)) {
    throw new ValidationError('artist_slug invalido.');
  }

  const linkKey = text(body.link_key, 32);
  if (!isSocialKey(linkKey)) throw new ValidationError('link_key no permitido.');

  const placement = text(body.placement, 16) as LinkPlacement;
  if (!LINK_PLACEMENTS.includes(placement)) throw new ValidationError('placement no permitido.');

  const userAgent = text(userAgentHeader, MAX_USER_AGENT_LENGTH);
  const requestedDevice = text(body.device_type, 16) as DeviceType;

  return {
    artist_slug: artistSlug,
    link_key: linkKey,
    placement,
    device_type: DEVICE_TYPES.includes(requestedDevice) ? requestedDevice : detectDevice(userAgent),
    user_agent: userAgent
  };
};

export type LinkClickStatsRow = {
  link_key: string | null;
  created_at: string;
};

export type ArtistLinkStat = {
  key: SocialKey;
  label: string;
  clicks: number;
};

// Cuenta los clics por red dentro del periodo [since, now]. Solo devuelve las
// redes que tuvieron al menos un clic, de mayor a menor; los empates quedan
// en el orden fijo de SOCIAL_KEYS para que la lista no baile entre cargas.
export const summarizeLinkClicks = (rows: LinkClickStatsRow[], since: Date, now: Date = new Date()): ArtistLinkStat[] => {
  const counts = new Map<SocialKey, number>();

  for (const row of rows) {
    if (!row.link_key || !isSocialKey(row.link_key)) continue;
    const createdAt = new Date(row.created_at).getTime();
    if (Number.isNaN(createdAt) || createdAt < since.getTime() || createdAt > now.getTime()) continue;
    counts.set(row.link_key, (counts.get(row.link_key) ?? 0) + 1);
  }

  return SOCIAL_KEYS
    .filter(key => (counts.get(key) ?? 0) > 0)
    .map(key => ({ key, label: SOCIAL_LABELS[key], clicks: counts.get(key) ?? 0 }))
    .sort((left, right) => right.clicks - left.clicks);
};
