import { NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { parseWaitlistRequest } from '@/lib/waitlist';

// Endpoint publico: recibe las solicitudes del formulario de
// www.lujourban.com/unete/. Es el unico punto por donde un visitante escribe
// en la base, asi que se protege con:
//  - Origin permitido (solo el sitio principal).
//  - Validacion y normalizacion estricta (lib/waitlist.ts).
//  - Campo trampa para bots ("website"): si llega lleno, se responde ok sin guardar.
//  - Tope por hora: si entran demasiadas solicitudes, se deja de guardar.
//  - WhatsApp unico: repetir el formulario no crea filas nuevas.
// Nunca devuelve mensajes internos de la base.

const allowedOrigins = new Set([
  'https://www.lujourban.com',
  'https://lujourban.com'
]);

const MAX_BODY_BYTES = 2_000;
const MAX_REQUESTS_PER_HOUR = 40;
const UNIQUE_VIOLATION = '23505';
const GENERIC_ERROR = 'No pudimos guardar tu solicitud. Intenta de nuevo en un momento.';

const corsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };

  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
};

const cleanSourceUrl = (value: unknown) => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim().slice(0, 300));
    if (!allowedOrigins.has(url.origin)) return null;
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return null;
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
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Solicitud demasiado grande.' }, { status: 413, headers });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400, headers });
  }

  const body = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

  // Campo trampa: las personas no lo ven; los bots lo llenan.
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true }, { status: 200, headers });
  }

  let entry;
  try {
    entry = parseWaitlistRequest(body);
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ error: 'Solicitud invalida.' }, { status: 400, headers });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('artist_waitlist')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since);
    if (countError) throw countError;
    if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      return NextResponse.json(
        { error: 'Estamos recibiendo muchas solicitudes. Intenta de nuevo mas tarde.' },
        { status: 429, headers }
      );
    }

    const { error } = await supabase.from('artist_waitlist').insert({
      ...entry,
      source_url: cleanSourceUrl(body.source_url)
    });

    if (error) {
      // Ya estaba en la lista con ese WhatsApp: para la persona es un exito.
      if (error.code === UNIQUE_VIOLATION) {
        return NextResponse.json({ ok: true, duplicate: true }, { status: 200, headers });
      }
      throw error;
    }
  } catch (error) {
    console.error('[waitlist] no se pudo guardar la solicitud:', error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500, headers });
  }

  return NextResponse.json({ ok: true }, { status: 201, headers });
};
