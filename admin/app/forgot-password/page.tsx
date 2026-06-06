import Link from 'next/link';
import { sendPasswordResetAction } from '../auth-actions';

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const params = await searchParams;

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
            {params.sent ? (
              <p className="auth-note">Si el correo existe, Supabase enviara un enlace para cambiar la clave.</p>
            ) : null}
            {params.error ? <p className="auth-error">No pude enviar el correo. Revisa la configuracion de Supabase.</p> : null}
            <button className="primary login-submit">Enviar</button>
          </form>
          <div className="login-links">
            <Link href="/login">Volver al login</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
