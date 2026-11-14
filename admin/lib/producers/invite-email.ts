// Correo de invitacion del productor (Resend). Mismo aspecto que el de los
// artistas, con texto propio.

import { ValidationError } from '@/lib/errors';
import { displayUrl } from './store-url';
import type { InviteMailer } from './types';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const renderProducerInvite = (stageName: string, link: string, storeUrl: string | null = null) => `
  <div style="background:#020302;padding:32px 18px;font-family:Arial,sans-serif;color:#fff;">
    <div style="max-width:560px;margin:0 auto;border:1px solid rgba(227,184,115,.32);border-radius:20px;padding:28px;background:#0d0b07;">
      <p style="margin:0 0 10px;color:#e3b873;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Lujo Urban</p>
      <h1 style="margin:0 0 14px;color:#fff;font-size:26px;">Tu espacio de productor está listo</h1>
      <p style="margin:0 0 12px;color:rgba(255,255,255,.72);line-height:1.6;">
        Hola ${escapeHtml(stageName)}. Ya puedes crear tu clave y entrar a tu portal de productor en Lujo Urban.
      </p>
      <p style="margin:0 0 24px;color:rgba(255,255,255,.62);line-height:1.6;">
        Desde allí vas a manejar tus beats y ver tus ventas.
      </p>
      <a href="${escapeHtml(link)}" style="display:inline-block;border-radius:999px;padding:14px 22px;background:#e3b873;color:#1a1204;text-decoration:none;font-weight:800;">
        Crear mi clave
      </a>
      ${storeUrl ? `
      <div style="margin:28px 0 0;padding:16px 18px;border:1px solid rgba(227,184,115,.28);border-radius:14px;background:#14110a;">
        <p style="margin:0 0 6px;color:#e3b873;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Tu tienda</p>
        <p style="margin:0 0 10px;color:rgba(255,255,255,.72);line-height:1.5;font-size:14px;">
          Ya tienes tu propia tienda en Lujo Urban. Compártela con quien quiera tus beats:
        </p>
        <a href="${escapeHtml(storeUrl)}" style="color:#e3b873;font-weight:700;word-break:break-all;">${escapeHtml(displayUrl(storeUrl))}</a>
      </div>` : ''}
      <p style="margin:24px 0 0;color:rgba(255,255,255,.42);font-size:12px;line-height:1.5;">
        Este enlace es personal. Si no esperabas esta invitación, puedes ignorar este correo.
      </p>
    </div>
  </div>
`;

export class ResendInviteMailer implements InviteMailer {
  constructor(private readonly apiKey: () => string | undefined = () => process.env.RESEND_API_KEY) {}

  assertReady() {
    if (!this.apiKey()) throw new ValidationError('Falta configurar RESEND_API_KEY para enviar invitaciones.');
  }

  async send({ email, stageName, link, storeUrl }: { email: string; stageName: string; link: string; storeUrl: string | null }) {
    const key = this.apiKey();
    if (!key) throw new ValidationError('Falta configurar RESEND_API_KEY para enviar invitaciones.');

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: 'Lujo Urban <pedidos@lujourban.com>',
        to: [email],
        subject: `Tu acceso de productor a Lujo Urban - ${stageName}`,
        html: renderProducerInvite(stageName, link, storeUrl)
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`No pude enviar la invitación por correo (${response.status}): ${detail}`);
    }
  }
}
