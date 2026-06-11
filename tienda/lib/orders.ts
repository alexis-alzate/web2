import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { sendDownloadEmail } from '@/lib/email';
import type { Beat, LicenseType } from '@/lib/types';

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

export async function approveOrder(supabase: SupabaseAdmin, orderId: string, paymentId: string) {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) return;

  // Idempotencia: si ya quedo aprobada, no duplicar tokens de descarga
  if (order.status === 'approved') return;

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id, license_type, amount, beats(*)')
    .eq('order_id', orderId);

  if (itemsError || !orderItems) return;

  await supabase
    .from('orders')
    .update({ status: 'approved', mp_payment_id: paymentId })
    .eq('id', orderId);

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
