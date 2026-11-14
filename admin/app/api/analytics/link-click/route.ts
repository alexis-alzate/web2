import { NextResponse } from 'next/server';
import { createAnalyticsSupabaseClient } from '@/lib/analytics';
import { ValidationError } from '@/lib/errors';
import { parseLinkClick } from '@/lib/link-clicks';

// Endpoint PUBLICO: la pagina de cada artista avisa aqui cuando alguien toca
// uno de sus enlaces (Spotify, Instagram...). Protecciones:
//   - solo acepta peticiones con Origin de lujourban.com;
//   - solo guarda valores de listas cerradas (ver lib/link-clicks.ts);
//   - la base rechaza artistas que no existen (llave foranea);
//   - un doble toque en 10 segundos cuenta una sola vez;
//   - nunca devuelve mensajes internos de la base.
// Si se cambia, mantener todas esas protecciones.

const allowedOrigins = new Set([
  'https://www.lujourban.com',
  'https://lujourban.com'
]);

const DUPLICATE_WINDOW_MS = 10_000;
const FOREIGN_KEY_VIOLATION = '23503';

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

  let row;
  try {
    row = parseLinkClick(payload, request.headers.get('user-agent'));
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : 'Solicitud invalida.';
    return NextResponse.json({ error: message }, { status: 400, headers });
  }

  try {
    const supabase = createAnalyticsSupabaseClient();
    const duplicateCutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
    const { data: duplicate, error: duplicateError } = await supabase
      .from('artist_link_clicks')
      .select('id')
      .eq('artist_slug', row.artist_slug)
      .eq('link_key', row.link_key)
      .eq('user_agent', row.user_agent)
      .gte('created_at', duplicateCutoff)
      .limit(1)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200, headers });
    }

    const { error } = await supabase.from('artist_link_clicks').insert(row);
    if (error?.code === FOREIGN_KEY_VIOLATION) {
      return NextResponse.json({ error: 'Artista no encontrado.' }, { status: 404, headers });
    }
    if (error) throw error;
  } catch (error) {
    console.error('[link-click] No se pudo registrar el clic', error);
    return NextResponse.json({ error: 'No se pudo registrar el clic.' }, { status: 500, headers });
  }

  return NextResponse.json({ ok: true }, { status: 201, headers });
};
