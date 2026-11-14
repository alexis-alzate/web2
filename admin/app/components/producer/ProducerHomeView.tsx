import { LICENSE_LABELS } from '@/lib/beats';
import type { EarningsSummary } from '@/lib/producers/earnings-summary';
import { formatCOP, formatSaleDate } from '@/lib/producers/format';
import type { EarningRow, ProducerBeat } from '@/lib/producers/types';
import { plural } from '@/lib/portal-format';
import { beatStoreUrl } from '@/lib/producers/store-url';
import { ProducerStoreLink } from './ProducerStoreLink';

// Vista pura: recibe todo por props y no lee nada (ni base de datos, ni
// sesion), asi se puede renderizar aparte para revisarla.

export type ProducerBeatCard = ProducerBeat & { coverUrl: string };

type ProducerHomeViewProps = {
  stageName: string;
  commissionPercent: number;
  summary: EarningsSummary;
  beats: ProducerBeatCard[];
  recentSales: EarningRow[];
  // Su tienda publica y el origen de la tienda (para enlazar cada beat).
  storeUrl: string | null;
  storeOrigin: string;
};

const beatMeta = (beat: ProducerBeat) =>
  [beat.bpm ? `${beat.bpm} BPM` : '', beat.key ?? '', beat.genre ?? ''].filter(Boolean).join(' · ');

export function ProducerHomeView({
  stageName,
  commissionPercent,
  summary,
  beats,
  recentSales,
  storeUrl,
  storeOrigin
}: ProducerHomeViewProps) {
  const firstName = stageName.split(/\s+/)[0];
  const share = Math.round((100 - commissionPercent) * 100) / 100;

  return (
    <>
      <h1 className="pt-title">Hola, {firstName}</h1>

      {storeUrl ? <ProducerStoreLink url={storeUrl} /> : null}

      <section className="pt-prod-sales" aria-label="Tus ganancias">
        <p className="pt-prod-label">Lo que has ganado</p>
        <p className="pt-prod-total">{formatCOP(summary.producerTotal)}</p>
        <p className="pt-prod-note">
          {summary.salesCount === 0
            ? 'Todavía no hay ventas.'
            : `${plural(summary.salesCount, 'venta', 'ventas')} · ${formatCOP(summary.monthProducerTotal)} este mes`}
        </p>
        <dl className="pt-prod-split">
          <div>
            <dt>Por pagar</dt>
            <dd>{formatCOP(summary.pendingAmount)}</dd>
          </div>
          <div>
            <dt>Ya pagado</dt>
            <dd>{formatCOP(summary.paidAmount)}</dd>
          </div>
        </dl>
        <p className="pt-help pt-prod-terms">
          De cada venta te corresponde el {share} %. Lujo Urban se queda con el {commissionPercent} %.
        </p>
      </section>

      <section className="pt-block">
        <h2 className="pt-h2">Tus beats</h2>
        {beats.length === 0 ? (
          <p className="pt-empty">Todavía no tienes beats en tu tienda. Tu tienda ya está abierta; aquí vas a subir y manejar tus beats cuando esa parte esté lista.</p>
        ) : (
          <ul className="pt-prod-rows">
            {beats.map(beat => (
              <li className="pt-prod-row" key={beat.id}>
                {beat.coverUrl
                  ? <img className="pt-prod-cover" src={beat.coverUrl} alt="" width="56" height="56" loading="lazy" />
                  : <span className="pt-prod-cover" aria-hidden="true" />}
                <div className="pt-prod-text">
                  <strong>
                    <a href={beatStoreUrl(beat.slug, storeOrigin)} target="_blank" rel="noopener noreferrer">{beat.title}</a>
                  </strong>
                  <span>{beatMeta(beat) || 'Sin detalles todavía'}</span>
                </div>
                <span
                  className={`pt-prod-chip${beat.status === 'sold_exclusive' ? ' is-sold' : ''}`}
                  title={beat.status === 'sold_exclusive' ? 'Se vendió con licencia exclusiva y ya no está disponible' : undefined}
                >
                  {beat.status === 'sold_exclusive' ? 'Vendido' : 'En la tienda'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pt-block">
        <h2 className="pt-h2">Últimas ventas</h2>
        {recentSales.length === 0 ? (
          <p className="pt-empty">Cuando se venda un beat tuyo, lo vas a ver aquí.</p>
        ) : (
          <ul className="pt-prod-rows">
            {recentSales.map(sale => (
              <li className="pt-prod-row is-sale" key={sale.id}>
                <div className="pt-prod-text">
                  <strong>{sale.beatTitle ?? 'Beat eliminado'}</strong>
                  <span>
                    Licencia {LICENSE_LABELS[sale.license].name.toLowerCase()} · {formatSaleDate(sale.createdAt)}
                    {' · '}
                    {sale.status === 'paid' ? 'Pagada' : 'Por pagar'}
                  </span>
                </div>
                <b className="pt-prod-amount">{formatCOP(sale.producerAmount)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
