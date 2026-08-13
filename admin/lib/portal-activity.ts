import 'server-only';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import type {
  PortalActivityEvent,
  PortalUserActivity,
  PortalUserActivityResult
} from '@/lib/portal-activity-types';

export const PORTAL_ACTIVITY_SESSION_COOKIE = 'lujo_portal_activity_session';
export const PORTAL_ACTIVITY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 2;

type PortalRole = 'admin' | 'artist';
type PortalLoginMethod = 'password' | 'passkey';

type StartPortalSessionInput = {
  userId: string;
  role: PortalRole;
  artistSlug: string | null;
  loginMethod: PortalLoginMethod;
  userAgent: string | null;
};

type RecordPortalActivityInput = {
  userId: string;
  sessionId?: string | null;
  eventType: string;
  eventLabel: string;
  metadata?: Record<string, unknown>;
};

const deviceTypeFromUserAgent = (userAgent: string | null) => {
  const value = (userAgent || '').toLowerCase();
  if (!value) return 'unknown';
  if (/ipad|tablet|kindle|silk/.test(value)) return 'tablet';
  if (/android|iphone|ipod|mobile/.test(value)) return 'mobile';
  return 'desktop';
};

const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const startPortalSession = async (input: StartPortalSessionInput) => {
  try {
    const supabase = createSupabaseAdminClient();
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const { error } = await supabase.from('portal_sessions').insert({
      id: sessionId,
      user_id: input.userId,
      role: input.role,
      artist_slug: input.artistSlug,
      login_method: input.loginMethod,
      device_type: deviceTypeFromUserAgent(input.userAgent),
      started_at: now,
      last_seen_at: now
    });

    if (error) return null;

    await supabase.from('portal_activity_events').insert({
      user_id: input.userId,
      session_id: sessionId,
      event_type: 'login',
      event_label: input.loginMethod === 'passkey'
        ? 'Inició sesión con huella o passkey'
        : 'Inició sesión con correo y clave'
    });

    return sessionId;
  } catch {
    return null;
  }
};

export const touchPortalSession = async (sessionId: string, userId: string) => {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from('portal_sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('ended_at', null);
  } catch {
    // La actividad nunca debe bloquear el uso normal del portal.
  }
};

export const recordPortalActivity = async (input: RecordPortalActivityInput) => {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from('portal_activity_events').insert({
      user_id: input.userId,
      session_id: input.sessionId || null,
      event_type: input.eventType,
      event_label: input.eventLabel,
      metadata: input.metadata || {}
    });
  } catch {
    // El registro es auxiliar y no debe hacer fallar la acción principal.
  }
};

export const recordCurrentPortalActivity = async (
  input: Omit<RecordPortalActivityInput, 'sessionId'>
) => {
  const cookieStore = await cookies();
  await recordPortalActivity({
    ...input,
    sessionId: cookieStore.get(PORTAL_ACTIVITY_SESSION_COOKIE)?.value || null
  });
};

export const endPortalSession = async (sessionId: string, userId: string, reason: 'logout' | 'expired' = 'logout') => {
  try {
    const supabase = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('portal_sessions')
      .update({
        last_seen_at: now,
        ended_at: now,
        end_reason: reason
      })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('ended_at', null);

    if (!error) {
      await recordPortalActivity({
        userId,
        sessionId,
        eventType: 'logout',
        eventLabel: reason === 'expired' ? 'La sesión expiró' : 'Cerró sesión'
      });
    }
  } catch {
    // El cierre de Supabase debe continuar aunque falle la telemetría.
  }
};

export const loadPortalUserActivities = async (userIds: string[]): Promise<PortalUserActivityResult> => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { available: true, byUserId: {} };

  try {
    const supabase = createSupabaseAdminClient();
    const { data: summaries, error: summaryError } = await supabase
      .from('portal_user_activity_summary')
      .select('user_id, login_count, last_login_at, total_active_seconds, last_session_id, last_session_started_at, last_seen_at, ended_at, last_login_method, last_device_type, last_session_seconds')
      .in('user_id', ids);

    if (summaryError) return { available: false, byUserId: {} };

    const eventLimit = Math.min(Math.max(ids.length * 8, 50), 1000);
    const { data: eventRows, error: eventError } = await supabase
      .from('portal_activity_events')
      .select('id, user_id, event_type, event_label, created_at')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(eventLimit);

    if (eventError) return { available: false, byUserId: {} };

    const eventsByUser = new Map<string, PortalActivityEvent[]>();
    for (const row of eventRows || []) {
      const current = eventsByUser.get(row.user_id) || [];
      if (current.length < 6) {
        current.push({
          id: row.id,
          type: row.event_type,
          label: row.event_label,
          createdAt: row.created_at
        });
        eventsByUser.set(row.user_id, current);
      }
    }

    const byUserId: Record<string, PortalUserActivity> = {};
    for (const row of summaries || []) {
      if (!row.last_session_id || !row.last_session_started_at || !row.last_seen_at) continue;
      byUserId[row.user_id] = {
        loginCount: asNumber(row.login_count),
        lastLoginAt: row.last_login_at,
        totalActiveSeconds: asNumber(row.total_active_seconds),
        lastSession: {
          id: row.last_session_id,
          startedAt: row.last_session_started_at,
          lastSeenAt: row.last_seen_at,
          endedAt: row.ended_at,
          durationSeconds: asNumber(row.last_session_seconds),
          loginMethod: row.last_login_method || 'unknown',
          deviceType: row.last_device_type || 'unknown'
        },
        events: eventsByUser.get(row.user_id) || []
      };
    }

    return { available: true, byUserId };
  } catch {
    return { available: false, byUserId: {} };
  }
};
