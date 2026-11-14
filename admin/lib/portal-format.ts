// Formato de numeros y fechas del portal (es-CO).

export const formatNumber = (value: number) => new Intl.NumberFormat('es-CO').format(value);

// "12 nov" a partir de AAAA-MM-DD.
export const formatDay = (dateKey: string) => new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC'
}).format(new Date(`${dateKey}T12:00:00Z`)).replace('.', '');

export const plural = (count: number, one: string, many: string) =>
  `${formatNumber(count)} ${count === 1 ? one : many}`;

export const percent = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)} %` : '0 %';

// "youtu.be" o "open.spotify.com": a donde lleva un enlace, para mostrarlo corto.
export const linkHost = (value: string | undefined | null) => {
  try {
    return new URL(String(value || '')).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
