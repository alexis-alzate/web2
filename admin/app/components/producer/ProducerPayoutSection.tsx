import { saveProducerPayoutDetailsAction } from '../../producer-payout-actions';
import { formatCOP, formatSaleDate } from '@/lib/producers/format';
import { payoutMethodLabel } from '@/lib/producers/payout-rules';
import type { PayoutDetails, PayoutRow } from '@/lib/producers/types';
import { ActionForm } from '../ActionForm';
import { SubmitButton } from '../SubmitButton';
import { PayoutFields } from './PayoutFields';

// "Tu pago": donde cobra el productor y los pagos que ya recibio. Vista sin
// lecturas: recibe todo por props.

type ProducerPayoutSectionProps = {
  payout: PayoutDetails | null;
  payouts: PayoutRow[];
  // Lo que Lujo Urban todavia le debe (para avisarle que falta decir donde pagarle).
  pendingAmount: number;
};

export function ProducerPayoutSection({ payout, payouts, pendingAmount }: ProducerPayoutSectionProps) {
  return (
    <section className="pt-block">
      <h2 className="pt-h2">Tu pago</h2>

      {!payout && pendingAmount > 0 ? (
        <p className="pt-help">
          Tienes {formatCOP(pendingAmount)} por cobrar. Dinos dónde quieres recibirlos para poder pagarte.
        </p>
      ) : null}

      <ActionForm
        key={payout ? `${payout.method}|${payout.account}|${payout.holder}` : 'sin-datos'}
        action={saveProducerPayoutDetailsAction}
        className="pt-form pt-card"
        savingMessage="Guardando cómo cobrar..."
        successMessage="Listo. Así te vamos a pagar."
      >
        <PayoutFields defaults={payout} />
        <SubmitButton className="primary" pendingText="Guardando...">
          {payout ? 'Guardar cambios' : 'Guardar cómo cobrar'}
        </SubmitButton>
      </ActionForm>

      <h3 className="pt-h3">Pagos recibidos</h3>
      {payouts.length === 0 ? (
        <p className="pt-empty">Cuando Lujo Urban te pague, el pago aparece aquí con su comprobante.</p>
      ) : (
        <ul className="pt-prod-rows">
          {payouts.map(item => (
            <li className="pt-prod-row is-sale" key={item.id}>
              <div className="pt-prod-text">
                <strong>{formatCOP(item.amount)}</strong>
                <span>
                  {payoutMethodLabel(item.method)} · {formatSaleDate(item.paidAt)} · Ref. {item.reference}
                </span>
              </div>
              <b className="pt-prod-amount">{item.earningsCount === 1 ? '1 venta' : `${item.earningsCount} ventas`}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
