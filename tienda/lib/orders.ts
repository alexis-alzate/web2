import { createSupabaseAdminClient } from '@/lib/supabase/server';

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
    .select('id')
    .eq('order_id', orderId);

  if (itemsError || !orderItems) return;

  await supabase
    .from('orders')
    .update({ status: 'approved', mp_payment_id: paymentId })
    .eq('id', orderId);

  await supabase.from('downloads').insert(
    orderItems.map((item) => ({ order_item_id: item.id }))
  );
}
