// Estadisticas que el artista ve en su portal (/mi-perfil).
//
// Salen de la tabla release_events, que llena la pagina publica del artista:
//   view          -> alguien vio la tarjeta del lanzamiento en la pagina
//   status_click  -> toco "Escuchar ahora" o la portada
//   chat_click    -> toco "Compartir"
// La pagina registra como maximo UNA visita y UNA accion por navegador, por
// lanzamiento y por dia. Por eso aqui se habla de "personas" y no de clics
// totales: quien escucha y ademas comparte el mismo dia cuenta una sola vez.
//
// `summarizeArtistStats` es pura (recibe las filas y la fecha) para poder
// probarla sin Supabase.

import { createAnalyticsSupabaseClient } from '@/lib/analytics';

export const STATS_PERIOD_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const BOGOTA_TIME_ZONE = 'America/Bogota';
const MAX_SOURCES = 5;

export type ArtistStatsRow = {
  event_type: string | null;
  referrer: string | null;
  source_url: string | null;
  created_at: string;
};

export type ArtistDailyStat = {
  // AAAA-MM-DD en hora de Bogota.
  date: string;
  visitors: number;
};

export type ArtistSourceStat = {
  key: string;
  label: string;
  visitors: number;
};

export type ArtistStats = {
  periodDays: number;
  visitors: number;
  listens: number;
  shares: number;
  // Las mismas tres cifras en los 30 dias anteriores, para comparar.
  previous: { visitors: number; listens: number; shares: number };
  daily: ArtistDailyStat[];
  sources: ArtistSourceStat[];
  hasData: boolean;
  // true = no se pudieron leer; la pagina muestra un aviso y sigue funcionando.
  failed: boolean;
};

const bogotaDateKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  google: 'Google',
  lujourban: 'Lujo Urban',
  direct: 'Enlace directo',
  other: 'Otros sitios'
};

const SOURCE_BY_UTM: Record<string, string> = {
  ig: 'instagram', instagram: 'instagram',
  fb: 'facebook', facebook: 'facebook',
  tiktok: 'tiktok', tt: 'tiktok',
  youtube: 'youtube', yt: 'youtube',
  whatsapp: 'whatsapp', wa: 'whatsapp',
  google: 'google'
};

const SOURCE_BY_HOST: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)lujourban\.com$/, 'lujourban']
];

const hostOf = (value: string | null) => {
  try {
    return value ? new URL(value).hostname.toLowerCase() : '';
  } catch {
    return '';
  }
};

const utmSourceOf = (value: string | null) => {
  try {
    return value ? (new URL(value).searchParams.get('utm_source') || '').trim().toLowerCase() : '';
  } catch {
    return '';
  }
};

// De donde llego la visita. Manda la etiqueta utm_source del enlace (la pone
// quien comparte); si no hay, el sitio desde el que se abrio la pagina.
// WhatsApp y muchas apps no dicen de donde viene la visita: esas quedan como
// "Enlace directo".
export const classifySource = (row: Pick<ArtistStatsRow, 'referrer' | 'source_url'>): string => {
  const fromUtm = SOURCE_BY_UTM[utmSourceOf(row.source_url)];
  if (fromUtm) return fromUtm;

  const host = hostOf(row.referrer);
  if (!host) return 'direct';
  return SOURCE_BY_HOST.find(([pattern]) => pattern.test(host))?.[1] ?? 'other';
};

const emptyCounts = () => ({ visitors: 0, listens: 0, shares: 0 });

export const emptyArtistStats = (now: Date = new Date(), failed = false): ArtistStats =>
  ({ ...summarizeArtistStats([], now), failed });

export const summarizeArtistStats = (rows: ArtistStatsRow[], now: Date = new Date()): ArtistStats => {
  const daily = new Map<string, ArtistDailyStat>();
  for (let offset = STATS_PERIOD_DAYS - 1; offset >= 0; offset--) {
    const date = bogotaDateKey(new Date(now.getTime() - offset * DAY_MS));
    daily.set(date, { date, visitors: 0 });
  }
  const previousDates = new Set<string>();
  for (let offset = STATS_PERIOD_DAYS * 2 - 1; offset >= STATS_PERIOD_DAYS; offset--) {
    previousDates.add(bogotaDateKey(new Date(now.getTime() - offset * DAY_MS)));
  }

  const current = emptyCounts();
  const previous = emptyCounts();
  const sources = new Map<string, number>();

  for (const row of rows) {
    const createdAt = new Date(row.created_at);
    if (Number.isNaN(createdAt.getTime())) continue;

    const date = bogotaDateKey(createdAt);
    const day = daily.get(date);
    const bucket = day ? current : previousDates.has(date) ? previous : null;
    if (!bucket) continue;

    if (row.event_type === 'view') {
      bucket.visitors += 1;
      if (day) {
        day.visitors += 1;
        const source = classifySource(row);
        sources.set(source, (sources.get(source) ?? 0) + 1);
      }
    } else if (row.event_type === 'status_click') {
      bucket.listens += 1;
    } else if (row.event_type === 'chat_click') {
      bucket.shares += 1;
    }
  }

  const ranked = Array.from(sources.entries())
    .filter(([key]) => key !== 'other')
    .sort((left, right) => right[1] - left[1]);
  const shown = ranked.slice(0, MAX_SOURCES);
  // Lo que no cabe en la lista se suma a "Otros sitios" para que el total cuadre.
  const rest = ranked.slice(MAX_SOURCES).reduce((sum, [, count]) => sum + count, 0) + (sources.get('other') ?? 0);
  if (rest > 0) shown.push(['other', rest]);

  return {
    periodDays: STATS_PERIOD_DAYS,
    ...current,
    previous,
    daily: Array.from(daily.values()),
    sources: shown.map(([key, visitors]) => ({ key, label: SOURCE_LABELS[key] ?? key, visitors })),
    hasData: current.visitors + current.listens + current.shares > 0,
    failed: false
  };
};

// Lee los eventos de UN artista. El slug viene siempre de la sesion (nunca
// del navegador), asi un artista no puede pedir los numeros de otro.
export const getArtistStats = async (artistSlug: string, now: Date = new Date()): Promise<ArtistStats> => {
  try {
    const since = new Date(now.getTime() - (STATS_PERIOD_DAYS * 2 + 1) * DAY_MS);
    const { data, error } = await createAnalyticsSupabaseClient()
      .from('release_events')
      .select('event_type,referrer,source_url,created_at')
      .eq('artist_slug', artistSlug)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(20000);
    if (error) throw error;

    return summarizeArtistStats((data ?? []) as ArtistStatsRow[], now);
  } catch (error) {
    console.error('[artist-stats] No se pudieron leer las estadisticas', error);
    return emptyArtistStats(now, true);
  }
};
