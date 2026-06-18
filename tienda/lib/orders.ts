import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { sendDownloadEmail, sendProducerSaleEmail } from '@/lib/email';
import type { Beat, LicenseType } from '@/lib/types';

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

type DownloadRow = {
  token: string;
  expires_at: string;
  download_count: number;
  max_downloads: number;
};

type OrderItemRow = {
  id: string;
  license_type: LicenseType;
  amount: number;
  beats: Beat;
  downloads: DownloadRow[];
};

type ApprovalResult = {
  should_send_email?: boolean;
};

type ProducerEarningRow = {
  id: string;
  license_type: LicenseType;
  gross_amount: number;
  platform_fee_amount: number;
  producer_amount: number;
  producers: {
    stage_name: string;
    email: string;
  } | null;
  beats: {
    title: string;
  } | null;
};

const isUsableDownload = (download: DownloadRow) =>
  new Date(download.expires_at) > new Date() && download.download_count < download.max_downloads;

const notifyProducersForOrder = async (supabase: SupabaseAdmin, orderId: string) => {
  const { data, error } = await supabase
    .from('producer_earnings')
    .select('id, license_type, gross_amount, platform_fee_amount, producer_amount, producers(stage_name, email), beats(title)')
    .eq('order_id', orderId)
    .is('producer_notified_at', null);

  if (error) {
    console.error('No se pudieron cargar ganancias de productores:', error);
    return;
  }

  const earnings = (data as unknown as ProducerEarningRow[] | null) ?? [];
  const byProducer = new Map<string, { name: string; email: string; earningIds: string[]; items: Parameters<typeof sendProducerSaleEmail>[2] }>();

  for (const earning of earnings) {
    if (!earning.producers?.email || !earning.producers.stage_name || !earning.beats?.title) continue;
    const current = byProducer.get(earning.producers.email) ?? {
      name: earning.producers.stage_name,
      email: earning.producers.email,
      earningIds: [],
      items: []
    };
    current.earningIds.push(earning.id);
    current.items.push({
      beatTitle: earning.beats.title,
      licenseType: earning.license_type,
      grossAmount: earning.gross_amount,
      platformFeeAmount: earning.platform_fee_amount,
      producerAmount: earning.producer_amount
    });
    byProducer.set(earning.producers.email, current);
  }

  for (const producer of byProducer.values()) {
    try {
      await sendProducerSaleEmail(producer.email, producer.name, producer.items);
      await supabase
        .from('producer_earnings')
        .update({
          producer_notified_at: new Date().toISOString(),
          producer_notification_error: null
        })
        .in('id', producer.earningIds);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido notificando al productor.';
      console.error('No se pudo notificar al productor:', message);
      await supabase
        .from('producer_earnings')
        .update({ producer_notification_error: message })
        .in('id', producer.earningIds);
    }
  }
};

export async function approveOrder(supabase: SupabaseAdmin, orderId: string, paymentId: string) {
  // La RPC bloquea la orden en Postgres, crea descargas faltantes y solo al
  // final marca la orden como aprobada. Webhooks duplicados no duplican tokens.
  const { data: approval, error: approvalError } = await supabase
    .rpc('approve_order_safely', { p_order_id: orderId, p_payment_id: paymentId })
    .maybeSingle();

  if (approvalError) throw approvalError;
  if (!(approval as ApprovalResult | null)?.should_send_email) {
    await notifyProducersForOrder(supabase, orderId);
    return;
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, buyer_email')
    .eq('id', orderId)
    .single();

  if (orderError || !order) throw orderError ?? new Error('No se encontro la orden aprobada.');

  const { data: rawItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id, license_type, amount, beats(*), downloads(token, expires_at, download_count, max_downloads)')
    .eq('order_id', orderId);

  if (itemsError || !rawItems?.length) throw itemsError ?? new Error('La orden aprobada no tiene items.');

  const emailItems = (rawItems as unknown as OrderItemRow[])
    .map((item) => {
      const download = item.downloads?.find(isUsableDownload);
      if (!download) return null;
      return {
        beat: item.beats,
        license_type: item.license_type,
        amount: item.amount,
        token: download.token
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (emailItems.length !== rawItems.length) {
    throw new Error('La orden aprobada no tiene descargas utilizables para todos los items.');
  }

  await sendDownloadEmail(order.buyer_email, emailItems);

  await supabase
    .from('orders')
    .update({ download_email_sent_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('download_email_sent_at', null);

  await notifyProducersForOrder(supabase, orderId);
}
