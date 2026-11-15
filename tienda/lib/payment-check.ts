// Comprueba que un pago aprobado de Mercado Pago cubre la orden antes de
// entregar archivos. Es pura: recibe el pago (tal como lo devuelve
// GET /v1/payments/:id) y el total de la orden.
//
// Solo se bloquea cuando se pago MENOS que el total o en otra moneda. Un monto
// mayor no bloquea: asi una diferencia a favor nunca deja a un comprador real
// sin sus archivos.

export type MercadoPagoPayment = {
  transaction_amount?: unknown;
  currency_id?: unknown;
};

export type PaymentCheck = { ok: true } | { ok: false; reason: string };

export const ORDER_CURRENCY = 'COP';

export const checkPaymentCoversOrder = (
  payment: MercadoPagoPayment,
  orderTotal: number
): PaymentCheck => {
  const paid = Number(payment.transaction_amount);
  if (!Number.isFinite(paid)) {
    return { ok: false, reason: 'El pago no trae un monto valido.' };
  }
  if (payment.currency_id !== ORDER_CURRENCY) {
    return { ok: false, reason: `Moneda inesperada: ${String(payment.currency_id)}.` };
  }
  if (paid < orderTotal) {
    return { ok: false, reason: `Se pago ${paid} y la orden vale ${orderTotal}.` };
  }
  return { ok: true };
};
