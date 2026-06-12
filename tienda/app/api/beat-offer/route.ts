import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const beatTitle = String(body?.beat_title || '').trim();
  const beatSlug = String(body?.beat_slug || '').trim();
  const fullName = String(body?.full_name || '').trim();
  const email = String(body?.email || '').trim();
  const amount = String(body?.amount || '').trim();
  const message = String(body?.message || '').trim();

  if (!beatTitle || !beatSlug || !fullName || !email.includes('@') || !amount) {
    return NextResponse.json({ error: 'Datos de oferta incompletos.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('Falta configurar RESEND_API_KEY, no se envio la oferta.');
    return NextResponse.json({ error: 'Correo no configurado.' }, { status: 500 });
  }

  const siteUrl = process.env.SITE_URL ?? 'https://tienda.lujourban.com';
  const offerTo = process.env.BEAT_OFFER_TO_EMAIL ?? 'pedidos@lujourban.com';
  const beatUrl = `${siteUrl}/${encodeURIComponent(beatSlug)}`;
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: 'Lujo Urban <pedidos@lujourban.com>',
    to: offerTo,
    replyTo: email,
    subject: `Oferta exclusiva: ${beatTitle}`,
    html: `
      <div style="background:#070706;padding:32px;font-family:Arial,sans-serif;color:#f4efe7;">
        <div style="max-width:620px;margin:0 auto;border:1px solid rgba(214,176,74,.35);border-radius:14px;background:#11100d;padding:24px;">
          <p style="margin:0 0 8px;color:#d6b04a;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Make an offer</p>
          <h1 style="margin:0 0 18px;color:#fff;font-size:24px;">${escapeHtml(beatTitle)}</h1>
          <p style="margin:0 0 10px;"><strong>Nombre:</strong> ${escapeHtml(fullName)}</p>
          <p style="margin:0 0 10px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p style="margin:0 0 10px;"><strong>Oferta:</strong> ${escapeHtml(amount)}</p>
          <p style="margin:18px 0 6px;color:#d6b04a;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Mensaje</p>
          <p style="white-space:pre-wrap;margin:0 0 20px;color:rgba(244,239,231,.78);">${escapeHtml(message || 'Sin mensaje adicional.')}</p>
          <a href="${beatUrl}" style="display:inline-block;color:#090806;background:#d6b04a;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px;">Ver beat</a>
        </div>
      </div>
    `
  });

  return NextResponse.json({ ok: true });
}
