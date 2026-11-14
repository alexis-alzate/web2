import { redirect } from 'next/navigation';
import {
  CONFIRM_API_PATH,
  CONFIRM_FAILURE_PATH,
  confirmCopy,
  parseConfirmRequest
} from '@/lib/auth-confirm';

// Esta pagina NO valida el enlace: solo lo muestra. Validarlo al abrirla lo
// gastaria cuando un escaner de correo la visite (ver lib/auth-confirm.ts).
// La validacion ocurre en `app/api/auth/confirm/route.ts`, al tocar el boton.
export default async function ConfirmPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (name: string) => {
    const value = params[name];
    return Array.isArray(value) ? value[0] : value;
  };

  const request = parseConfirmRequest(read);
  if (!request) redirect(CONFIRM_FAILURE_PATH);

  const copy = confirmCopy(request.type);

  return (
    <main className="login">
      <div className="login-shell">
        <h1 className="title login-title">Lujo Urban</h1>
        <section className="section login-card">
          <form action={CONFIRM_API_PATH} method="post" className="login-form">
            <h2>{copy.title}</h2>
            <p className="auth-note">{copy.text}</p>
            <input type="hidden" name="token_hash" value={request.tokenHash} />
            <input type="hidden" name="type" value={request.type} />
            <input type="hidden" name="next" value={request.next} />
            <button className="primary login-submit">{copy.button}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
