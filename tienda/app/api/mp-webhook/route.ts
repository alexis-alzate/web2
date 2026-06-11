import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { approveOrder } from '@/lib/orders';

async function getPaymentId(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const topic = url.searchParams.get('topic') ?? url.searchParams.get('type');
  const idFromQuery = url.searchParams.get('id') ?? url.searchParams.get('data.id');

  if (topic === 'payment' && idFromQuery) return idFromQuery;

  const body = await request.json().catch(() => null);
  if (body?.type === 'payment' && body?.data?.id) return String(body.data.id);
  if (body?.topic === 'payment' && body?.resource) return String(body.resource).split('/').pop() ?? null;

  return null;
}

export async function POST(request: Request) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: 'Falta configurar MercadoPago.' }, { status: 500 });
  }

  const paymentId = await getPaymentId(request);
  if (!paymentId) {
    return NextResponse.json({ ok: true });
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
