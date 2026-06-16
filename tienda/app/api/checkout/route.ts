import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { LICENSE_LABELS, priceForLicense, filePathForLicense, type Beat, type LicenseType } from '@/lib/types';

type CheckoutItem = { beat_id: string; license_type: LicenseType };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const buyerEmail: string | undefined = body?.buyer_email;
  const items: CheckoutItem[] | undefined = body?.items;

  if (!buyerEmail || !buyerEmail.includes('@')) {
    return NextResponse.json({ error: 'Correo inválido.' }, { status: 400 });
  }
  if (!items || !items.length) {
    return NextResponse.json({ error: 'El carrito está vacío.' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Los IDs de demo (catalogo duplicado para previsualizacion) tienen el formato "<uuid>-demo-N"
  const realBeatId = (id: string) => id.replace(/-demo-\d+$/, '');

  const beatIds = items.map((it) => realBeatId(it.beat_id));
  if (new Set(beatIds).size !== beatIds.length) {
    return NextResponse.json(
      { error: 'Solo puedes elegir una licencia por beat en cada orden.' },
      { status: 400 }
    );
  }

  const uniqueBeatIds = [...new Set(beatIds)];
  const { data: beats, error: beatsError } = await supabase
    .from('beats')
    .select('*')
    .in('id', uniqueBeatIds);

  if (beatsError || !beats) {
    return NextResponse.json({ error: 'No se pudieron cargar los beats.' }, { status: 500 });
  }

  const beatById = new Map<string, Beat>(beats.map((b: Beat) => [b.id, b]));
  const validLicenses: LicenseType[] = ['basic', 'premium', 'exclusive'];

  // Validar cada item antes de crear la orden: que el beat exista, siga
  // disponible y tenga archivo para la licencia elegida (no cobrar sin poder entregar).
  for (const it of items) {
    const beat = beatById.get(realBeatId(it.beat_id));
    if (!beat) {
      return NextResponse.json({ error: 'Uno de los beats del carrito ya no existe.' }, { status: 400 });
    }
    if (!validLicenses.includes(it.license_type)) {
      return NextResponse.json({ error: 'Tipo de licencia inválido.' }, { status: 400 });
    }
    if (beat.status !== 'available') {
      return NextResponse.json(
        { error: `"${beat.title}" ya no está disponible.` },
        { status: 400 }
      );
    }
    if (!filePathForLicense(beat, it.license_type)) {
      return NextResponse.json(
        { error: `"${beat.title}" no tiene archivo cargado para la licencia ${LICENSE_LABELS[it.license_type].name}.` },
        { status: 400 }
      );
    }
  }

  const orderItems = items.map((it) => {
    const beat = beatById.get(realBeatId(it.beat_id))!;
    return {
      beat,
      license_type: it.license_type,
      amount: priceForLicense(beat, it.license_type)
    };
  });

  const totalAmount = orderItems.reduce((sum, it) => sum + it.amount, 0);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({ buyer_email: buyerEmail, total_amount: totalAmount, status: 'pending' })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: 'No se pudo crear la orden.' }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    orderItems.map((it) => ({
      order_id: order.id,
      beat_id: it.beat.id,
      license_type: it.license_type,
      amount: it.amount
    }))
  );

  if (itemsError) {
    return NextResponse.json({ error: 'No se pudieron guardar los items de la orden.' }, { status: 500 });
  }

  const siteUrl = process.env.SITE_URL ?? 'https://tienda.lujourban.com';
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json({ error: 'Falta configurar MercadoPago.' }, { status: 500 });
  }

  const preference: Record<string, unknown> = {
    items: orderItems.map((it) => ({
      title: `${it.beat.title} — Licencia ${LICENSE_LABELS[it.license_type].name}`,
      quantity: 1,
      unit_price: it.amount,
      currency_id: 'COP'
    })),
    payer: { email: buyerEmail },
    external_reference: order.id,
    back_urls: {
      success: `${siteUrl}/descarga?order_id=${order.id}`,
      pending: `${siteUrl}/descarga?order_id=${order.id}`,
      failure: `${siteUrl}/?checkout=failure`
    }
  };

  // auto_return requiere una URL publica (https); en local (http) MP la rechaza
  if (siteUrl.startsWith('https://')) {
    preference.auto_return = 'approved';
  }

  // notification_url solo si es un dominio real (los tuneles de prueba como loca.lt
  // muestran una pagina de aviso que rompe la validacion del webhook)
  if (siteUrl.startsWith('https://') && !siteUrl.includes('loca.lt')) {
    preference.notification_url = `${siteUrl}/api/mp-webhook`;
  }

  const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(preference)
  });

  const mpData = await mpResponse.json();

  if (!mpResponse.ok || !mpData.init_point) {
    console.error('MercadoPago error:', mpData);
    return NextResponse.json({ error: 'No se pudo crear la preferencia de pago.' }, { status: 500 });
  }

  await supabase.from('orders').update({ mp_preference_id: mpData.id }).eq('id', order.id);

  return NextResponse.json({ init_point: mpData.init_point });
}
