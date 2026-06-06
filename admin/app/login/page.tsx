import { PasskeyLoginButton } from '../components/PasskeyLoginButton';
import { PasswordField } from '../components/PasswordField';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const params = await searchParams;
  const errorMessages: Record<string, string> = {
    auth: 'Supabase rechazo el acceso. Revisa el usuario en Authentication.',
    config: 'Falta configurar Supabase en Vercel.',
    credentials: 'Correo o clave incorrectos.',
    expired: 'Sesion expirada. Inicia de nuevo.',
    rate: 'Demasiados intentos. Espera un momento y vuelve a probar.',
    unconfirmed: 'El correo aun no esta confirmado en Supabase.'
  };
  const errorMessage = params.error ? errorMessages[params.error] || errorMessages.auth : '';

  return (
    <main className="login">
      <div className="login-shell">
        <h1 className="title login-title">Lujo Urban</h1>
        <section className="section login-card">
          <form action="/api/login" method="post" className="login-form">
            <label>
              Correo
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <PasswordField label="Clave" name="password" autoComplete="current-password" />
            {params.error ? <p className="auth-error">{errorMessage}</p> : null}
            {params.reset ? <p className="auth-note">Clave actualizada. Inicia sesion de nuevo.</p> : null}
            <button className="primary login-submit">Ingresar</button>
          </form>
          <div className="login-links">
            <a href="/forgot-password">Olvide mi clave</a>
          </div>
        </section>
        <PasskeyLoginButton />
      </div>
    </main>
  );
}
