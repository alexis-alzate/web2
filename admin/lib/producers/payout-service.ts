// Reglas de los pagos a productores.
//
//  - El productor guarda DONDE quiere recibir su plata (su portal).
//  - El admin registra el pago DESPUES de hacer la transferencia. Esta app no
//    mueve dinero: solo lleva la cuenta de lo que se debe y lo que ya se pagó.
//
// Quien llama (la Server Action) ya comprobo la sesion: el id del productor
// sale de la sesion y el nombre del admin, de su cuenta.

import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { MIN_PAYOUT_AMOUNT, parsePayoutDetails, parseReference } from './payout-rules';
import type { PayoutMailer, PayoutResult, ProducerRepository } from './types';

export type PayoutDetailsInput = { method: unknown; account: unknown; holder: unknown };

export class ProducerPayoutService {
  constructor(
    private readonly producers: ProducerRepository,
    // Avisa al productor que se le pago. Opcional: sin el, el pago se registra igual.
    private readonly mailer?: PayoutMailer,
    private readonly logError: (message: string, error: unknown) => void = (message, error) => console.error(message, error)
  ) {}

  // El productor guarda (o cambia) como quiere cobrar.
  async saveDetails(producerId: string, input: PayoutDetailsInput): Promise<void> {
    const producer = await this.producers.findById(producerId);
    if (!producer) throw new NotFoundError('No encontré tu cuenta de productor.');
    if (producer.status !== 'active') {
      throw new ForbiddenError('Tu cuenta de productor no está activa. Contacta a Lujo Urban.');
    }

    // Se valida todo ANTES de guardar nada.
    const details = parsePayoutDetails(input);
    await this.producers.updatePayoutDetails(producerId, details);
  }

  // El admin ya transfirio: queda registrado y las ventas LIBERADAS pasan a
  // "pagadas". Devuelve ademas si el aviso por correo al productor salio.
  async registerPayout(
    producerId: string,
    input: { reference: unknown; paidBy: string }
  ): Promise<PayoutResult & { notified: boolean }> {
    const producer = await this.producers.findById(producerId);
    if (!producer) throw new NotFoundError('No encontré a ese productor.');
    if (!producer.payout) {
      throw new ValidationError('Este productor todavía no dijo cómo quiere recibir su pago.');
    }

    const reference = parseReference(input.reference);

    // La base vuelve a comprobar que la cuenta no cambió mientras el admin
    // miraba la pantalla, y que haya algo pendiente.
    const result = await this.producers.registerPayout({
      producerId,
      reference,
      paidBy: input.paidBy,
      expectedAccount: producer.payout.account,
      minAmount: MIN_PAYOUT_AMOUNT
    });

    // El pago ya esta registrado: si el correo falla, NO se deshace nada.
    let notified = false;
    if (this.mailer) {
      try {
        await this.mailer.send({
          email: producer.email,
          stageName: producer.stageName,
          amount: result.amount,
          earningsCount: result.earningsCount,
          method: producer.payout.method,
          account: producer.payout.account,
          reference
        });
        notified = true;
      } catch (error) {
        this.logError(`No se pudo avisar por correo el pago ${result.payoutId}`, error);
      }
    }

    return { ...result, notified };
  }
}
