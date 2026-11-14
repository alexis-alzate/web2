import { NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { producerApplicationService } from '@/lib/producer-applications';

// Endpoint publico: recibe las solicitudes del formulario de
// www.lujourban.com/vender/. Es controlador delgado: las reglas (validacion,
// tope por hora, correo unico) viven en ProducerApplicationService. Protecciones:
//  - Origin permitido (solo el sitio principal).
//  - Cuerpo pequeno y JSON valido.
//  - Campo trampa para bots ("website"): si llega lleno, se responde ok sin guardar.
//  - NO crea cuentas ni envia correos: solo guarda la solicitud. La cuenta se
//    crea cuando el admin aprueba.
// Nunca devuelve mensajes internos de la base.

const allowedOrigins = new Set([
  'https://www.lujourban.com',
  'https://lujourban.com'
]);

const MAX_BODY_BYTES = 2_000;
const GENERIC_ERROR = 'No pudimos guardar tu solicitud. Intenta de nuevo en un momento.';

const corsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
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

  try {
    const result = await producerApplicationService.submit(body, cleanSourceUrl(body.source_url));
    return NextResponse.json(
      result === 'created' ? { ok: true } : { ok: true, duplicate: true },
      { status: result === 'created' ? 201 : 200, headers }
    );
  } catch (error) {
    // Los errores con tipo (validacion, tope por hora) traen un mensaje legible.
    if (isAppError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    console.error('[producer-applications] no se pudo guardar la solicitud:', error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500, headers });
  }
};
