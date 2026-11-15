// Aviso al productor cuando Lujo Urban le registra un pago (Resend).
// Mismo aspecto que la invitacion. No lleva la cuenta completa: solo una pista
// ("•••• 4567") para que el productor reconozca a donde llego.

import { formatCOP } from './format';
import { maskAccount, payoutMethodLabel } from './payout-rules';
import type { PayoutMailer, PayoutNotice } from './types';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const renderPayoutNotice = (notice: PayoutNotice, accountHint: string) => `
  <div style="background:#020302;padding:32px 18px;font-family:Arial,sans-serif;color:#fff;">
    <div style="max-width:560px;margin:0 auto;border:1px solid rgba(227,184,115,.32);border-radius:20px;padding:28px;background:#0d0b07;">
      <p style="margin:0 0 10px;color:#e3b873;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Lujo Urban</p>
      <h1 style="margin:0 0 14px;color:#fff;font-size:26px;">Te acabamos de pagar</h1>
      <p style="margin:0 0 18px;color:rgba(255,255,255,.72);line-height:1.6;">
        Hola ${escapeHtml(notice.stageName)}. Te transferimos
        <strong style="color:#e3b873;">${escapeHtml(formatCOP(notice.amount))}</strong>
        por ${notice.earningsCount === 1 ? '1 venta' : `${notice.earningsCount} ventas`}.
      </p>
      <div style="padding:16px 18px;border:1px solid rgba(227,184,115,.28);border-radius:14px;background:#14110a;">
        <p style="margin:0 0 6px;color:rgba(255,255,255,.72);font-size:14px;">
          Enviado a tu ${escapeHtml(payoutMethodLabel(notice.method))}: <strong>${escapeHtml(accountHint)}</strong>
        </p>
        <p style="margin:0;color:rgba(255,255,255,.72);font-size:14px;">
          Referencia del comprobante: <strong>${escapeHtml(notice.reference)}</strong>
        </p>
      </div>
      <p style="margin:22px 0 0;color:rgba(255,255,255,.42);font-size:12px;line-height:1.5;">
        Puedes ver este pago en tu portal de productor, en "Tu pago". Si no lo recibiste, responde a este correo.
      </p>
    </div>
  </div>
`;

export class ResendPayoutMailer implements PayoutMailer {
  constructor(private readonly apiKey: () => string | undefined = () => process.env.RESEND_API_KEY) {}

  async send(notice: PayoutNotice) {
    const key = this.apiKey();
    if (!key) throw new Error('Falta configurar RESEND_API_KEY para avisar el pago.');

    const accountHint = maskAccount(notice.method, notice.account);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: 'Lujo Urban <pedidos@lujourban.com>',
        to: [notice.email],
        subject: `Te pagamos ${formatCOP(notice.amount)} - Lujo Urban`,
        html: renderPayoutNotice(notice, accountHint)
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`No pude enviar el aviso de pago (${response.status}): ${detail}`);
    }
  }
}
