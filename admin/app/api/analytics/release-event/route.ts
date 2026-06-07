import { NextResponse } from 'next/server';
import { createAnalyticsSupabaseClient, type ReleaseEventType } from '@/lib/analytics';

const allowedOrigins = new Set([
  'https://www.lujourban.com',
  'https://lujourban.com'
]);

const validEventTypes = new Set<ReleaseEventType>(['view', 'chat_click', 'status_click']);

const corsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };

  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
};

const cleanText = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const detectDevice = (userAgent: string) => {
  const text = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|playbook/.test(text)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(text)) return 'mobile';
  return 'desktop';
};

export const OPTIONS = async (request: Request) => {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: allowedOrigins.has(origin || '') ? 204 : 403,
    headers: corsHeaders(origin)
  });
};

export const POST = async (request: Request) => {
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  if (!origin || !allowedOrigins.has(origin)) {
    return NextResponse.json({ error: 'Origin no permitido.' }, { status: 403, headers });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido.' }, { status: 400, headers });
  }

  const body = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const releaseSlug = cleanText(body.release_slug, 90);
  const eventType = cleanText(body.event_type, 32) as ReleaseEventType;
  const userAgent = cleanText(request.headers.get('user-agent'), 500);

  if (!releaseSlug) {
    return NextResponse.json({ error: 'release_slug es obligatorio.' }, { status: 400, headers });
  }

  if (!validEventTypes.has(eventType)) {
    return NextResponse.json({ error: 'event_type no permitido.' }, { status: 400, headers });
  }

  const row = {
    release_slug: releaseSlug,
    event_type: eventType,
    source_url: cleanText(body.source_url, 500),
    referrer: cleanText(body.referrer, 500),
    device_type: cleanText(body.device_type, 32) || detectDevice(userAgent),
    user_agent: userAgent
  };

  try {
    const supabase = createAnalyticsSupabaseClient();
    const { error } = await supabase.from('release_events').insert(row);
    if (error) throw error;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo registrar el evento.' },
      { status: 500, headers }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201, headers });
};

