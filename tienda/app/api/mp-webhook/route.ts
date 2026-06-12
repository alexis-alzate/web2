import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { approveOrder } from '@/lib/orders';

function getPaymentId(url: URL, body: unknown): string | null {
  const topic = url.searchParams.get('topic') ?? url.searchParams.get('type');
  const idFromQuery = url.searchParams.get('id') ?? url.searchParams.get('data.id');

  if (topic === 'payment' && idFromQuery) return idFromQuery;

  const payload = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {};

  if (payload.type === 'payment' && data.id) return String(data.id);
  if (payload.topic === 'payment' && payload.resource) return String(payload.resource).split('/').pop() ?? null;

  return null;
}

const parseSignatureHeader = (value: string | null) => {
  const parts = new Map<string, string>();
  value?.split(',').forEach((part) => {
    const [key, signatureValue] = part.split('=').map((item) => item.trim());
    if (key && signatureValue) parts.set(key, signatureValue);
  });
  return parts;
};

const parseBody = (bodyText: string) => {
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    return null;
  }
};

function isValidWebhookSignature(request: Request, paymentId: string) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('MERCADOPAGO_WEBHOOK_SECRET no configurado; webhook sin validacion de firma.');
    return true;
  }

  const requestId = request.headers.get('x-request-id');
  const signature = parseSignatureHeader(request.headers.get('x-signature'));
  const timestamp = signature.get('ts');
  const receivedHash = signature.get('v1');

  if (!requestId || !timestamp || !receivedHash) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${timestamp};`;
  const expectedHash = createHmac('sha256', secret).update(manifest).digest('hex');
  const expected = Buffer.from(expectedHash);
  const received = Buffer.from(receivedHash);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: 'Falta configurar MercadoPago.' }, { status: 500 });
  }

  const url = new URL(request.url);
  const bodyText = await request.text().catch(() => '');
  const body = parseBody(bodyText);
  const paymentId = getPaymentId(url, body);
  if (!paymentId) {
    return NextResponse.json({ ok: true });
  }

  if (!isValidWebhookSignature(request, paymentId)) {
    return NextResponse.json({ error: 'Firma invalida.' }, { status: 401 });
  }

  const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  // Pago inexistente (id falso o de otra cuenta): responder 200 para no generar reintentos
  if (paymentRes.status === 404) {
    return NextResponse.json({ ok: true });
  }

  // Fallo transitorio consultando el pago: responder 500 para que MercadoPago reintente
  if (!paymentRes.ok) {
    return NextResponse.json({ error: 'No se pudo consultar el pago.' }, { status: 500 });
  }

  const payment = await paymentRes.json();
  const orderId: string | undefined = payment.external_reference;

  if (!orderId) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createSupabaseAdminClient();

  if (payment.status === 'approved') {
    await approveOrder(supabase, orderId, String(payment.id));
    return NextResponse.json({ ok: true });
  }

  // Pago rechazado o cancelado: marcar la orden solo si sigue pendiente.
  // Si el comprador reintenta y un pago posterior queda aprobado, approveOrder
  // puede pasar la orden de rejected a approved sin problema.
  if (payment.status === 'rejected' || payment.status === 'cancelled') {
    await supabase
      .from('orders')
      .update({ status: 'rejected', mp_payment_id: String(payment.id) })
      .eq('id', orderId)
      .eq('status', 'pending');
  }

  return NextResponse.json({ ok: true });
}
