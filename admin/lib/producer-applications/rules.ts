// Reglas puras de las solicitudes de productor: que es una solicitud valida,
// como se normaliza y que comision se acepta al aprobar. No sabe de Supabase
// ni de Next: el endpoint solo lee la peticion y el servicio decide el resto.

import { ValidationError } from '@/lib/errors';

export const APPLICATION_STATUSES = ['new', 'approved', 'rejected'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'Por revisar',
  approved: 'Aprobada',
  rejected: 'Rechazada'
};

// Acuerdo base con los productores: Lujo Urban se queda con el 15 %.
export const DEFAULT_COMMISSION_PERCENT = 15;

export type ApplicationInput = {
  stageName: string;
  email: string;
  musicUrl: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const text = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';

// "instagram.com/kaleb" o "https://youtube.com/@kaleb" -> URL https completa.
// Solo se aceptan http(s); cualquier otro esquema (javascript:, data:...) se rechaza.
export const normalizeMusicUrl = (value: unknown): string | null => {
  const raw = text(value, 300);
  if (!raw) return null;
  // "javascript:...", "data:...", "mailto:..." (esquema sin //) no son enlaces de musica.
  if (/^[a-z][a-z0-9+.-]*:(?!\/\/)/i.test(raw)) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.')) return null;
    url.protocol = 'https:';
    const clean = url.toString();
    return clean.length <= 300 ? clean : null;
  } catch {
    return null;
  }
};

// Valida y normaliza una solicitud. Lanza ValidationError con un mensaje que
// la persona puede leer tal cual en el formulario.
export const parseApplication = (body: unknown): ApplicationInput => {
  const data = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  const stageName = text(data.stage_name, 80);
  if (stageName.length < 2) throw new ValidationError('Escribe tu nombre artístico.');

  const email = text(data.email, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new ValidationError('Revisa tu correo.');

  const musicUrl = normalizeMusicUrl(data.music_url);
  if (!musicUrl) throw new ValidationError('Pega el enlace a tu música (Instagram, YouTube, BeatStars...).');

  return { stageName, email, musicUrl };
};

// Comision de Lujo Urban al aprobar. Vacio = la base del acuerdo (15 %).
export const parseCommission = (value: unknown): number => {
  if (value === undefined || value === null || String(value).trim() === '') return DEFAULT_COMMISSION_PERCENT;
  const parsed = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new ValidationError('La comisión debe estar entre 0 y 100.');
  }
  return Math.round(parsed * 100) / 100;
};
