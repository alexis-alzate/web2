const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const sendArtistInviteEmail = async (
  email: string,
  artistName: string,
  actionLink: string
) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Falta configurar RESEND_API_KEY para enviar la invitacion.');

  const safeName = escapeHtml(artistName);
  const safeLink = escapeHtml(actionLink);
  const html = `
    <div style="background:#020302;padding:32px 18px;font-family:Arial,sans-serif;color:#fff;">
      <div style="max-width:560px;margin:0 auto;border:1px solid rgba(57,255,99,.28);border-radius:20px;padding:28px;background:#081009;">
        <p style="margin:0 0 10px;color:#39ff63;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Lujo Urban</p>
        <h1 style="margin:0 0 14px;color:#fff;font-size:26px;">Tu portal de artista esta listo</h1>
        <p style="margin:0 0 12px;color:rgba(255,255,255,.72);line-height:1.6;">
          Hola ${safeName}. Ya puedes crear tu clave y entrar a tu espacio privado de Lujo Urban.
        </p>
        <p style="margin:0 0 24px;color:rgba(255,255,255,.62);line-height:1.6;">
          Desde alli podras actualizar tus enlaces, ordenar tus redes y cambiar el enlace de tu lanzamiento actual. El diseño oficial permanece protegido.
        </p>
        <a href="${safeLink}" style="display:inline-block;border-radius:999px;padding:14px 22px;background:#39ff63;color:#001406;text-decoration:none;font-weight:800;">
          Crear mi clave
        </a>
        <p style="margin:24px 0 0;color:rgba(255,255,255,.42);font-size:12px;line-height:1.5;">
          Este enlace es personal. Si no esperabas esta invitacion, puedes ignorar este correo.
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
      to: [email],
      subject: `Tu acceso de artista a Lujo Urban - ${artistName}`,
      html
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`No pude enviar la invitacion por correo (${response.status}): ${detail}`);
  }
};
