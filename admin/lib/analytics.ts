import { createClient } from '@supabase/supabase-js';

export type ReleaseEventType = 'view' | 'chat_click' | 'status_click';

export type DailyStat = {
  date: string;
  view: number;
  interaction: number;
};

export type ReleaseAnalyticsSummary = {
  totals: Record<ReleaseEventType, number>;
  interactionsTotal: number;
  conversionRate: number;
  topViews: Array<{ slug: string; count: number }>;
  topChatClicks: Array<{ slug: string; count: number }>;
  topStatusClicks: Array<{ slug: string; count: number }>;
  distribution: Array<{ type: ReleaseEventType; count: number }>;
  dailyStats: DailyStat[];
  hasData: boolean;
  error?: string;
};

type ReleaseEventRow = {
  release_slug: string | null;
  event_type: ReleaseEventType | string | null;
  created_at: string;
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
    .slice(0, 10);

export const getReleaseAnalyticsSummary = async (): Promise<ReleaseAnalyticsSummary> => {
  const totals = emptyTotals();
  const topViews = new Map<string, number>();
  const topChatClicks = new Map<string, number>();
  const topStatusClicks = new Map<string, number>();
  const dailyMap = new Map<string, DailyStat>();

  // Generar ultimos 30 dias para el mapa
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    dailyMap.set(dateStr, { date: dateStr, view: 0, interaction: 0 });
  }

  try {
    const supabase = createAnalyticsSupabaseClient();
    const { data, error } = await supabase
      .from('release_events')
      .select('release_slug,event_type,created_at')
      .order('created_at', { ascending: false })
      .limit(20000);

    if (error) throw error;

    (data as ReleaseEventRow[] | null || []).forEach(row => {
      const eventType = row.event_type as ReleaseEventType;
      const slug = String(row.release_slug || '').trim();
      const createdAt = row.created_at;
      
      if (!slug || !validEventTypes.includes(eventType)) return;

      totals[eventType] += 1;
      if (eventType === 'view') incrementBySlug(topViews, slug);
      if (eventType === 'chat_click') incrementBySlug(topChatClicks, slug);
      if (eventType === 'status_click') incrementBySlug(topStatusClicks, slug);

      // Procesar estadisticas diarias
      if (createdAt) {
        const dateStr = createdAt.split('T')[0];
        const dayStat = dailyMap.get(dateStr);
        if (dayStat) {
          if (eventType === 'view') {
            dayStat.view += 1;
          } else {
            dayStat.interaction += 1;
          }
        }
      }
    });
  } catch (error) {
    return {
      totals,
      interactionsTotal: 0,
      conversionRate: 0,
      topViews: [],
      topChatClicks: [],
      topStatusClicks: [],
      distribution: validEventTypes.map(type => ({ type, count: 0 })),
      dailyStats: Array.from(dailyMap.values()),
      hasData: false,
      error: error instanceof Error ? error.message : 'No se pudieron cargar las analiticas.'
    };
  }

  const interactionsTotal = totals.chat_click + totals.status_click;
  const conversionRate = totals.view > 0 ? (interactionsTotal / totals.view) * 100 : 0;

  return {
    totals,
    interactionsTotal,
    conversionRate,
    topViews: sortTop(topViews),
    topChatClicks: sortTop(topChatClicks),
    topStatusClicks: sortTop(topStatusClicks),
    distribution: validEventTypes.map(type => ({ type, count: totals[type] })),
    dailyStats: Array.from(dailyMap.values()),
    hasData: (totals.view + interactionsTotal) > 0
  };
};

