import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { sendDownloadEmail } from '@/lib/email';
import type { Beat, LicenseType } from '@/lib/types';

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export async function approveOrder(supabase: SupabaseAdmin, orderId: string, paymentId: string) {
  // Idempotencia atomica: solo una llamada logra pasar la orden a approved;
  // webhooks duplicados o concurrentes no generan tokens ni emails extra.
  // Se acepta desde pending o rejected (un pago reintentado puede aprobarse
  // despues de un intento rechazado).
  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update({ status: 'approved', mp_payment_id: paymentId })
    .eq('id', orderId)
    .neq('status', 'approved')
    .select();

  if (updateError || !updated || updated.length === 0) return;
  const order = updated[0];

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id, beat_id, license_type, amount, beats(*)')
    .eq('order_id', orderId);

  if (itemsError || !orderItems) return;

  // Una licencia exclusiva retira el beat de la venta automaticamente
  const exclusiveBeatIds = orderItems
    .filter((item) => item.license_type === 'exclusive')
    .map((item) => item.beat_id as string);
  if (exclusiveBeatIds.length) {
    await supabase.from('beats').update({ status: 'sold_exclusive' }).in('id', exclusiveBeatIds);
  }

  const { data: downloads, error: downloadsError } = await supabase
    .from('downloads')
    .insert(orderItems.map((item) => ({ order_item_id: item.id })))
    .select('order_item_id, token');

  if (downloadsError || !downloads) return;

  const tokenByItemId = new Map(downloads.map((d) => [d.order_item_id, d.token]));

  const emailItems = orderItems
    .map((item) => {
      const token = tokenByItemId.get(item.id);
      if (!token) return null;
      return {
        beat: item.beats as unknown as Beat,
        license_type: item.license_type as LicenseType,
        amount: item.amount as number,
        token
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  await sendDownloadEmail(order.buyer_email, emailItems);
}
