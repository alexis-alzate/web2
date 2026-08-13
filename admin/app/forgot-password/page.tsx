import Link from 'next/link';
import { sendPasswordResetAction } from '../auth-actions';
import { PasswordResetSubmitButton } from '../components/PasswordResetSubmitButton';

const errorMessages: Record<string, string> = {
  email: 'Escribe el correo de la cuenta.',
  'rate-limit': 'El enlace ya fue solicitado. Revisa tu correo y espera un minuto antes de reenviarlo.',
  send: 'No pudimos enviar el correo en este momento. Intenta de nuevo.'
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const params = await searchParams;
  const sent = params.sent === '1';
  const rateLimited = params.error === 'rate-limit';
  const errorMessage = params.error ? errorMessages[params.error] || errorMessages.send : null;

  return (
    <main className="login">
      <div className="login-shell">
        <h1 className="title login-title">Lujo Urban</h1>
        <section className="section login-card">
          <form action={sendPasswordResetAction} className="login-form">
            <label>
              Correo
              <input name="email" type="email" autoComplete="email" required />
            </label>
            {sent ? (
              <p className="auth-note" role="status">
                Enviamos el enlace. Revisa tu bandeja y Spam; usa únicamente el correo más reciente.
              </p>
            ) : null}
            {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}
            <PasswordResetSubmitButton startCooldown={sent || rateLimited} />
          </form>
          <div className="login-links">
            <Link href="/login">Volver al login</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
