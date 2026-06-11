import { LICENSE_LABELS, type Beat, type LicenseType } from './beats';

type DownloadEmailItem = {
  beat: Beat;
  license_type: LicenseType;
  amount: number;
  token: string;
};

const formatCOP = (value: number) => '$' + Number(value).toLocaleString('es-CO');

// Mismo correo de descarga que envia la tienda, enviado via API de Resend
// (sin dependencia extra). Lanza error si falla, para que el toast lo muestre.
export async function sendDownloadEmail(buyerEmail: string, items: DownloadEmailItem[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Falta configurar RESEND_API_KEY en el panel.');

  const siteUrl = process.env.TIENDA_URL ?? 'https://tienda.lujourban.com';

  const rows = items
    .map((item) => {
      const downloadUrl = `${siteUrl}/api/download/${item.token}`;
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid rgba(243,195,94,0.2);">
            <p style="margin:0;color:#f4efe7;font-weight:600;">${item.beat.title}</p>
            <p style="margin:4px 0 0;color:rgba(244,239,231,0.6);font-size:13px;">
              Licencia ${LICENSE_LABELS[item.license_type].name} — ${formatCOP(item.amount)}
            </p>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid rgba(243,195,94,0.2);text-align:right;">
            <a href="${downloadUrl}" style="background:#f3c35e;color:#1a1308;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px;display:inline-block;">Descargar</a>
          </td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <div style="background:#0b0907;padding:32px;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#16110b;border:1px solid rgba(243,195,94,0.3);border-radius:16px;padding:24px;">
        <h1 style="color:#f3c35e;font-size:22px;margin:0 0 8px;">Lujo Urban</h1>
        <p style="color:#f4efe7;margin:0 0 20px;">¡Gracias por tu compra! Aquí están tus enlaces de descarga.</p>
        <table style="width:100%;border-collapse:collapse;">
          ${rows}
        </table>
        <p style="color:rgba(244,239,231,0.5);font-size:12px;margin-top:20px;">
          Cada enlace permite hasta 3 descargas y expira en 48 horas. Si tienes problemas, responde a este correo.
        </p>
      </div>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from: 'Lujo Urban <pedidos@lujourban.com>',
      to: [buyerEmail],
      subject: 'Tus beats están listos para descargar',
      html
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend respondió ${response.status}: ${detail}`);
  }
}
