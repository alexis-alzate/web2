import { createClient } from '@supabase/supabase-js';

export type ReleaseEventType = 'view' | 'chat_click' | 'status_click';

export type ReleaseAnalyticsSummary = {
  totals: Record<ReleaseEventType, number>;
  interactionsTotal: number;
  topViews: Array<{ slug: string; count: number }>;
  topChatClicks: Array<{ slug: string; count: number }>;
  distribution: Array<{ type: ReleaseEventType; count: number }>;
  hasData: boolean;
  error?: string;
};

type ReleaseEventRow = {
  release_slug: string | null;
  event_type: ReleaseEventType | string | null;
};

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

const incrementBySlug = (map: Map<string, number>, slug: string) => {
  map.set(slug, (map.get(slug) || 0) + 1);
};

const sortTop = (map: Map<string, number>) =>
  Array.from(map.entries())
    .map(([slug, count]) => ({ slug, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);

export const getReleaseAnalyticsSummary = async (): Promise<ReleaseAnalyticsSummary> => {
  const totals = emptyTotals();
  const topViews = new Map<string, number>();
  const topChatClicks = new Map<string, number>();

  try {
    const supabase = createAnalyticsSupabaseClient();
    const { data, error } = await supabase
      .from('release_events')
      .select('release_slug,event_type')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) throw error;

    (data as ReleaseEventRow[] | null || []).forEach(row => {
      const eventType = row.event_type;
      const slug = String(row.release_slug || '').trim();
      if (!slug || !validEventTypes.includes(eventType as ReleaseEventType)) return;

      totals[eventType as ReleaseEventType] += 1;
      if (eventType === 'view') incrementBySlug(topViews, slug);
      if (eventType === 'chat_click') incrementBySlug(topChatClicks, slug);
    });
  } catch (error) {
    return {
      totals,
      interactionsTotal: 0,
      topViews: [],
      topChatClicks: [],
      distribution: validEventTypes.map(type => ({ type, count: 0 })),
      hasData: false,
      error: error instanceof Error ? error.message : 'No se pudieron cargar las analiticas.'
    };
  }

  const interactionsTotal = totals.view + totals.chat_click + totals.status_click;

  return {
    totals,
    interactionsTotal,
    topViews: sortTop(topViews),
    topChatClicks: sortTop(topChatClicks),
    distribution: validEventTypes.map(type => ({ type, count: totals[type] })),
    hasData: interactionsTotal > 0
  };
};

