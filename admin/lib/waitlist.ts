// Lista de espera de artistas (formulario publico de www.lujourban.com/unete/).
//
// Aqui viven las reglas: que es una solicitud valida y como se normaliza.
// El endpoint (app/api/waitlist/route.ts) solo lee la peticion y guarda; el
// panel (app/actions-waitlist.ts) solo cambia el estado.

import { ValidationError } from '@/lib/errors';

export const FOLLOWERS_RANGES = ['lt_1k', '1k_10k', '10k_50k', 'gt_50k'] as const;
export type FollowersRange = (typeof FOLLOWERS_RANGES)[number];

export const FOLLOWERS_LABELS: Record<FollowersRange, string> = {
  lt_1k: 'Menos de 1.000',
  '1k_10k': '1.000 a 10.000',
  '10k_50k': '10.000 a 50.000',
  gt_50k: 'Mas de 50.000'
};

export const WAITLIST_STATUSES = ['new', 'contacted', 'approved', 'rejected'] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const WAITLIST_STATUS_LABELS: Record<WaitlistStatus, string> = {
  new: 'Nueva',
  contacted: 'Contactado',
  approved: 'Aprobado',
  rejected: 'Descartado'
};

export type WaitlistEntry = {
  id: string;
  stage_name: string;
  whatsapp: string;
  instagram: string;
  followers_range: FollowersRange;
  status: WaitlistStatus;
  created_at: string;
};

export type WaitlistRequest = {
  stage_name: string;
  whatsapp: string;
  instagram: string;
  followers_range: FollowersRange;
};

export const isFollowersRange = (value: unknown): value is FollowersRange =>
  typeof value === 'string' && (FOLLOWERS_RANGES as readonly string[]).includes(value);

export const isWaitlistStatus = (value: unknown): value is WaitlistStatus =>
  typeof value === 'string' && (WAITLIST_STATUSES as readonly string[]).includes(value);

const text = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';

// "300 123 4567", "+57 300-123-4567" o "573001234567" -> "573001234567".
// Un celular colombiano de 10 digitos (empieza por 3) recibe el indicativo 57;
// cualquier otro numero debe venir con su indicativo.
export const normalizeWhatsapp = (value: unknown) => {
  const digits = text(value, 40).replace(/\D/g, '').replace(/^00/, '');
  if (digits.length === 10 && digits.startsWith('3')) return `57${digits}`;
  return digits;
};

// "@usuario", "instagram.com/usuario/" o "https://www.instagram.com/usuario?x=1" -> "usuario".
export const normalizeInstagram = (value: unknown) =>
  text(value, 120)
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/[/?#].*$/, '')
    .replace(/^@+/, '');

// Valida y normaliza una solicitud. Lanza ValidationError con un mensaje que
// la persona puede leer tal cual en el formulario.
export const parseWaitlistRequest = (body: unknown): WaitlistRequest => {
  const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  const stageName = text(data.stage_name, 80);
  if (stageName.length < 2) {
    throw new ValidationError('Escribe tu nombre artistico.');
  }

  const whatsapp = normalizeWhatsapp(data.whatsapp);
  if (!/^[0-9]{10,15}$/.test(whatsapp) || (whatsapp.length === 10 && !whatsapp.startsWith('3'))) {
    throw new ValidationError('Revisa tu WhatsApp. Si no es de Colombia, escribelo con el indicativo del pais.');
  }

  const instagram = normalizeInstagram(data.instagram);
  if (!/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
    throw new ValidationError('Revisa tu usuario de Instagram.');
  }

  if (!isFollowersRange(data.followers_range)) {
    throw new ValidationError('Elige cuantos seguidores tienes.');
  }

  return {
    stage_name: stageName,
    whatsapp,
    instagram,
    followers_range: data.followers_range
  };
};

export const waitlistWhatsappUrl = (whatsapp: string) => `https://wa.me/${whatsapp}`;
export const waitlistInstagramUrl = (instagram: string) => `https://www.instagram.com/${instagram}/`;
