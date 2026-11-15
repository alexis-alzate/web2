import { registerProducerPayoutAction } from '../producer-payout-actions';
import { formatCOP } from '@/lib/producers/format';
import { payoutMethodLabel } from '@/lib/producers/payout-rules';
import type { PayoutDetails } from '@/lib/producers';
import { ActionForm } from './ActionForm';
import { SubmitButton } from './SubmitButton';

// Pago al productor, dentro de su tarjeta del panel. Vista sin lecturas: recibe
// todo por props. El admin ve cuanto se le debe y a que cuenta transferir, hace
// la transferencia por fuera (Nequi, banco...) y aqui deja el registro.

type ProducerPayoutControlProps = {
  producerId: string;
  stageName: string;
  pendingAmount: number;
  pendingCount: number;
  payout: PayoutDetails | null;
};

export function ProducerPayoutControl({
  producerId,
  stageName,
  pendingAmount,
  pendingCount,
  payout
}: ProducerPayoutControlProps) {
  return (
    <div className="producer-payout">
      <p>
        <strong>Por pagar: {formatCOP(pendingAmount)}</strong>
        <span className="muted">
          {' '}
          · {pendingCount === 1 ? '1 venta' : `${pendingCount} ventas`}
        </span>
      </p>

      {payout ? (
        <p className="muted">
          Cobra por {payoutMethodLabel(payout.method)}: <strong>{payout.account}</strong>
          {payout.holder ? ` · Titular: ${payout.holder}` : ''}
        </p>
      ) : (
        <p className="muted">Todavía no dijo cómo quiere recibir su pago. Cuando lo haga, aparece aquí.</p>
      )}

      {payout && pendingAmount > 0 ? (
        <ActionForm
          key={`${pendingAmount}|${payout.account}`}
          action={registerProducerPayoutAction}
          className="grid producer-payout-form"
          savingMessage={`Registrando el pago a ${stageName}...`}
          successMessage="Pago registrado."
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
            Ya transferí {formatCOP(pendingAmount)} a esa cuenta
          </label>
          <SubmitButton className="primary" pendingText="Registrando...">
            Registrar pago
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
