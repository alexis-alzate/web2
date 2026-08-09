import { NextResponse } from 'next/server';
import { createAnalyticsSupabaseClient, type ReleaseEventType } from '@/lib/analytics';

const allowedOrigins = new Set([
  'https://www.lujourban.com',
  'https://lujourban.com'
]);

const validEventTypes = new Set<ReleaseEventType>(['view', 'chat_click', 'status_click']);
const validDeviceTypes = new Set(['mobile', 'tablet', 'desktop']);
const releaseSlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,88}[a-z0-9])?$/;

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

const cleanSourceUrl = (value: unknown) => {
  const raw = cleanText(value, 500);
  if (!raw) return '';

  try {
    const url = new URL(raw);
    if (!allowedOrigins.has(url.origin)) return '';
    url.hash = '';
    return url.toString().slice(0, 500);
  } catch {
    return '';
  }
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
  const artistSlug = cleanText(body.artist_slug, 90);
  const eventType = cleanText(body.event_type, 32) as ReleaseEventType;
  const userAgent = cleanText(request.headers.get('user-agent'), 500);
  const sourceUrl = cleanSourceUrl(body.source_url);
  const requestedDevice = cleanText(body.device_type, 32);

  if (!releaseSlug || !releaseSlugPattern.test(releaseSlug)) {
    return NextResponse.json({ error: 'release_slug invalido.' }, { status: 400, headers });
  }

  if (!validEventTypes.has(eventType)) {
    return NextResponse.json({ error: 'event_type no permitido.' }, { status: 400, headers });
  }

  if (!sourceUrl) {
    return NextResponse.json({ error: 'source_url no permitido.' }, { status: 400, headers });
  }

  const row = {
    release_slug: releaseSlug,
    artist_slug: artistSlug || null,
    event_type: eventType,
    source_url: sourceUrl,
    referrer: cleanText(body.referrer, 500),
    device_type: validDeviceTypes.has(requestedDevice) ? requestedDevice : detectDevice(userAgent),
    user_agent: userAgent
  };

  try {
    const supabase = createAnalyticsSupabaseClient();
    const duplicateCutoff = new Date(Date.now() - 10_000).toISOString();
    const { data: duplicate, error: duplicateError } = await supabase
      .from('release_events')
      .select('id')
      .eq('release_slug', row.release_slug)
      .eq('event_type', row.event_type)
      .eq('source_url', row.source_url)
      .eq('user_agent', row.user_agent)
      .gte('created_at', duplicateCutoff)
      .limit(1)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200, headers });
    }

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
