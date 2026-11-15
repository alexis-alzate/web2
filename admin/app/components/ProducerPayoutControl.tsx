import { registerProducerPayoutAction } from '../producer-payout-actions';
import { formatCOP, formatSaleDate } from '@/lib/producers/format';
import { MIN_PAYOUT_AMOUNT, payoutMethodLabel } from '@/lib/producers/payout-rules';
import type { PayoutDetails } from '@/lib/producers';
import { ActionForm } from './ActionForm';
import { SubmitButton } from './SubmitButton';

// Pago al productor, dentro de su tarjeta del panel. Vista sin lecturas: recibe
// todo por props. El admin ve cuanto se le puede pagar HOY (lo liberado), lo que
// aun esta en espera y a que cuenta transferir; hace la transferencia por fuera
// (Nequi, banco...) y aqui deja el registro.

type ProducerPayoutControlProps = {
  producerId: string;
  stageName: string;
  // Lo liberado: se paga en el siguiente pago.
  availableAmount: number;
  availableCount: number;
  // Lo que todavia esta en los dias de espera y cuando se libera lo primero.
  holdingAmount: number;
  nextReleaseAt: string | null;
  payout: PayoutDetails | null;
};

export function ProducerPayoutControl({
  producerId,
  stageName,
  availableAmount,
  availableCount,
  holdingAmount,
  nextReleaseAt,
  payout
}: ProducerPayoutControlProps) {
  const reachesMinimum = availableAmount >= MIN_PAYOUT_AMOUNT;

  return (
    <div className="producer-payout">
      <p>
        <strong>Para pagar hoy: {formatCOP(availableAmount)}</strong>
        <span className="muted">
          {' '}
          · {availableCount === 1 ? '1 venta liberada' : `${availableCount} ventas liberadas`}
        </span>
      </p>
      {holdingAmount > 0 ? (
        <p className="muted">
          En espera: {formatCOP(holdingAmount)}
          {nextReleaseAt ? ` · lo primero se libera el ${formatSaleDate(nextReleaseAt)}` : ''}
        </p>
      ) : null}

      {payout ? (
        <p className="muted">
          Cobra por {payoutMethodLabel(payout.method)}: <strong>{payout.account}</strong>
          {payout.holder ? ` · Titular: ${payout.holder}` : ''}
        </p>
      ) : (
        <p className="muted">Todavía no dijo cómo quiere recibir su pago. Cuando lo haga, aparece aquí.</p>
      )}

      {payout && availableAmount > 0 && !reachesMinimum ? (
        <p className="muted">
          El pago mínimo es {formatCOP(MIN_PAYOUT_AMOUNT)}. Faltan {formatCOP(MIN_PAYOUT_AMOUNT - availableAmount)} liberados.
        </p>
      ) : null}

      {payout && reachesMinimum ? (
        <ActionForm
          key={`${availableAmount}|${payout.account}`}
          action={registerProducerPayoutAction}
          className="grid producer-payout-form"
          savingMessage={`Registrando el pago a ${stageName}...`}
          successMessage="Pago registrado. Le llega un correo al productor."
        >
          <input type="hidden" name="producerId" value={producerId} />
          <label>
            Referencia de la transferencia
            <input
              name="reference"
              type="text"
              maxLength={120}
              required
              placeholder="Número del comprobante"
              autoComplete="off"
            />
          </label>
          <label className="producer-payout-check">
            <input type="checkbox" name="confirmed" required />
            Ya transferí {formatCOP(availableAmount)} a esa cuenta
          </label>
          <SubmitButton className="primary" pendingText="Registrando...">
            Registrar pago
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
