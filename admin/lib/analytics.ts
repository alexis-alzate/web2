import { createClient } from '@supabase/supabase-js';

export type ReleaseEventType = 'view' | 'chat_click' | 'status_click';

export type DailyStat = {
  date: string;
  view: number;
  interaction: number;
};

export type ReleaseStat = {
  slug: string;
  artistSlug: string | null;
  views: number;
  interactions: number;
  interactionRate: number;
};

export type PeriodTotals = {
  views: number;
  interactions: number;
  interactionRate: number;
};

export type ReleaseAnalyticsSummary = {
  totals: Record<ReleaseEventType, number>;
  interactionsTotal: number;
  interactionRate: number;
  releases: ReleaseStat[];
  previous: PeriodTotals;
  dailyStats: DailyStat[];
  periodDays: number;
  hasData: boolean;
  error?: string;
};

type ReleaseEventRow = {
  release_slug: string | null;
  artist_slug: string | null;
  event_type: ReleaseEventType | string | null;
  created_at: string;
};

const PERIOD_DAYS = 15;
const TOTAL_DAYS = PERIOD_DAYS * 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const BOGOTA_TIME_ZONE = 'America/Bogota';

const emptyTotals = (): Record<ReleaseEventType, number> => ({
  view: 0,
  chat_click: 0,
  status_click: 0
});

const validEventTypes: ReleaseEventType[] = ['view', 'chat_click', 'status_click'];

const getSupabaseUrl = () => {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!value) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL.');
  return value;
};

const getServiceRoleKey = () => {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para leer analiticas.');
  return value;
};

export const createAnalyticsSupabaseClient = () =>
  createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

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

type ReleaseAccumulator = {
  slug: string;
  artistSlug: string | null;
  views: number;
  interactions: number;
};

const releaseIdentity = (slug: string, artistSlug: string | null) =>
  `${artistSlug || 'zaetta'}::${slug}`;

const buildReleaseStats = (map: Map<string, ReleaseAccumulator>): ReleaseStat[] =>
  Array.from(map.values())
    .map(({ slug, artistSlug, views, interactions }) => ({
      slug,
      artistSlug,
      views,
      interactions,
      interactionRate: views > 0 ? (interactions / views) * 100 : 0
    }))
    .sort((left, right) => right.views - left.views)
    .slice(0, 20);

const periodTotals = (totals: Record<ReleaseEventType, number>): PeriodTotals => {
  const interactions = totals.chat_click + totals.status_click;
  return {
    views: totals.view,
    interactions,
    interactionRate: totals.view > 0 ? (interactions / totals.view) * 100 : 0
  };
};

export const getReleaseAnalyticsSummary = async (): Promise<ReleaseAnalyticsSummary> => {
  const currentTotals = emptyTotals();
  const previousTotals = emptyTotals();
  const currentReleaseMap = new Map<string, ReleaseAccumulator>();
  const dailyMap = new Map<string, DailyStat>();
  const now = new Date();

  for (let i = TOTAL_DAYS - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - (i * DAY_MS));
    const dateKey = bogotaDateKey(date);
    dailyMap.set(dateKey, { date: dateKey, view: 0, interaction: 0 });
  }

  const dateKeys = Array.from(dailyMap.keys());
  const currentDateKeys = new Set(dateKeys.slice(-PERIOD_DAYS));

  try {
    const supabase = createAnalyticsSupabaseClient();
    const queryStart = new Date(now.getTime() - ((TOTAL_DAYS + 1) * DAY_MS));
    const { data, error } = await supabase
      .from('release_events')
      .select('release_slug,artist_slug,event_type,created_at')
      .gte('created_at', queryStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(20000);

    if (error) throw error;

    (data as ReleaseEventRow[] | null || []).forEach(row => {
      const eventType = row.event_type as ReleaseEventType;
      const slug = String(row.release_slug || '').trim();
      const artistSlug = String(row.artist_slug || '').trim() || null;
      const createdAt = new Date(row.created_at);

      if (!slug || !validEventTypes.includes(eventType) || Number.isNaN(createdAt.getTime())) return;

      const dateKey = bogotaDateKey(createdAt);
      const dayStat = dailyMap.get(dateKey);
      if (!dayStat) return;

      if (eventType === 'view') dayStat.view += 1;
      else dayStat.interaction += 1;

      const period = currentDateKeys.has(dateKey) ? currentTotals : previousTotals;
      period[eventType] += 1;

      if (!currentDateKeys.has(dateKey)) return;

      const identity = releaseIdentity(slug, artistSlug);
      const releaseEntry = currentReleaseMap.get(identity) || {
        slug,
        artistSlug,
        views: 0,
        interactions: 0
      };
      if (eventType === 'view') releaseEntry.views += 1;
      else releaseEntry.interactions += 1;
      currentReleaseMap.set(identity, releaseEntry);
    });
  } catch (error) {
    return {
      totals: currentTotals,
      interactionsTotal: 0,
      interactionRate: 0,
      releases: [],
      previous: periodTotals(previousTotals),
      dailyStats: Array.from(dailyMap.values()),
      periodDays: PERIOD_DAYS,
      hasData: false,
      error: error instanceof Error ? error.message : 'No se pudieron cargar las analiticas.'
    };
  }

  const current = periodTotals(currentTotals);

  return {
    totals: currentTotals,
    interactionsTotal: current.interactions,
    interactionRate: current.interactionRate,
    releases: buildReleaseStats(currentReleaseMap),
    previous: periodTotals(previousTotals),
    dailyStats: Array.from(dailyMap.values()),
    periodDays: PERIOD_DAYS,
    hasData: (current.views + current.interactions) > 0
  };
};
