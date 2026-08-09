'use server';

import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { sendDownloadEmail } from '@/lib/email';
import type { Beat, LicenseType } from '@/lib/beats';

type DownloadRow = {
  id: string;
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

const isUsable = (d: DownloadRow) =>
  new Date(d.expires_at) > new Date() && d.download_count < d.max_downloads;

// Reenvia el correo de descarga de una orden aprobada. Si los tokens de un
// item ya vencieron o agotaron sus usos, genera uno nuevo (re-entrega para
// compradores que perdieron sus archivos).
export const resendOrderEmailAction = async (formData: FormData) => {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const orderId = formData.get('id') as string;
  if (!orderId) throw new Error('Falta el id de la orden.');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, buyer_email, status')
    .eq('id', orderId)
    .single();

  if (orderError || !order) throw new Error('No se encontró la orden.');
  if (order.status !== 'approved') throw new Error('Solo se puede reenviar el correo de órdenes aprobadas.');

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('id, license_type, amount, beats(*), downloads(*)')
    .eq('order_id', orderId);

  if (itemsError || !items?.length) throw new Error('La orden no tiene items.');

  const emailItems = [];
  for (const raw of items) {
    const item = raw as unknown as OrderItemRow;
    let usable = (item.downloads ?? []).find(isUsable);

    if (!usable) {
      const { data: created, error: createError } = await supabase
        .from('downloads')
        .insert({ order_item_id: item.id })
        .select('id, token, expires_at, download_count, max_downloads')
        .single();
      if (createError || !created) {
        throw new Error(`No se pudo generar un nuevo enlace para "${item.beats.title}".`);
      }
      usable = created as DownloadRow;
    }

    emailItems.push({
      beat: item.beats,
      license_type: item.license_type,
      amount: item.amount,
      token: usable.token
    });
  }

  await sendDownloadEmail(order.buyer_email, emailItems);
};
