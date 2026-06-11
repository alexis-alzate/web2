import Link from 'next/link';
import AutoRefresh from './AutoRefresh';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { approveOrder } from '@/lib/orders';
import { formatCOP } from '@/lib/format';
import { LICENSE_LABELS, type Beat, type LicenseType } from '@/lib/types';

export const dynamic = 'force-dynamic';

type OrderItem = {
  id: string;
  license_type: LicenseType;
  amount: number;
  beats: Beat;
  downloads: { token: string; download_count: number; max_downloads: number; expires_at: string }[];
};

export default async function DescargaPage({
  searchParams
}: {
  searchParams: Promise<{ order_id?: string; payment_id?: string; status?: string }>;
}) {
  const { order_id, payment_id, status } = await searchParams;

  if (!order_id) {
    return (
      <main className="descarga-page">
        <p className="beats-loading">Falta el identificador de la orden.</p>
      </main>
    );
  }

  const supabase = createSupabaseAdminClient();
  let { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*, beats(*), downloads(*))')
    .eq('id', order_id)
    .single();

  if (error || !order) {
    return (
      <main className="descarga-page">
        <p className="beats-loading">No encontramos esta orden.</p>
      </main>
    );
  }

  // Respaldo para entornos donde MercadoPago no puede llamar al webhook (ej. localhost):
  // si volvemos del checkout con un pago aprobado, confirmamos la orden aqui mismo.
  if (order.status === 'pending' && status === 'approved' && payment_id) {
    await approveOrder(supabase, order_id, payment_id);
    const refetch = await supabase
      .from('orders')
      .select('*, order_items(*, beats(*), downloads(*))')
      .eq('id', order_id)
      .single();
    if (refetch.data) order = refetch.data;
  }

  if (order.status === 'pending') {
    return (
      <main className="descarga-page">
        <AutoRefresh seconds={5} />
        <h1 className="descarga-title">Procesando tu pago…</h1>
        <p className="descarga-text">
          Estamos confirmando tu pago con MercadoPago. Esta página se actualiza sola —
          cuando se confirme vas a poder descargar tus beats acá.
        </p>
      </main>
    );
  }

  if (order.status === 'rejected') {
    return (
      <main className="descarga-page">
        <h1 className="descarga-title">Pago no aprobado</h1>
        <p className="descarga-text">Tu pago no fue aprobado. Si crees que esto es un error, escribinos.</p>
      </main>
    );
  }

  const items = (order.order_items as OrderItem[]) ?? [];

  return (
    <main className="descarga-page">
      <h1 className="descarga-title">¡Gracias por tu compra!</h1>
      <p className="descarga-text">
        Tus archivos están listos. Cada enlace permite hasta 3 descargas y expira en 48 horas.
      </p>

      <ul className="descarga-list">
        {items.map((item) => {
          const download = item.downloads?.[0];
          return (
            <li key={item.id} className="descarga-item">
              <div className="descarga-item-info">
                <p className="descarga-item-title">{item.beats.title}</p>
                <p className="descarga-item-license">
                  Licencia {LICENSE_LABELS[item.license_type].name} — {formatCOP(item.amount)}
                </p>
              </div>
              {download ? (
                <a className="beat-row-btn" href={`/api/download/${download.token}`}>
                  <span className="beat-row-btn-icon">⬇</span>Descargar
                </a>
              ) : (
                <span className="beat-row-sold">No disponible</span>
              )}
            </li>
          );
        })}
      </ul>

      <Link href="/" className="descarga-volver">
        Volver a la tienda
      </Link>
    </main>
  );
}
