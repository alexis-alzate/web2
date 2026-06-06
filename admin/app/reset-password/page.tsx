import { updatePasswordAction } from '../auth-actions';

const errorMessages: Record<string, string> = {
  short: 'La clave debe tener minimo 8 caracteres.',
  match: 'Las claves no coinciden.',
  session: 'El enlace expiro o no es valido. Solicita otro correo.'
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <main className="login">
      <div className="login-shell">
        <h1 className="title login-title">Lujo Urban</h1>
        <section className="section login-card">
          <form action={updatePasswordAction} className="login-form">
            <label>
              Nueva clave
              <input name="password" type="password" autoComplete="new-password" required />
            </label>
            <label>
              Confirmar clave
              <input name="confirmation" type="password" autoComplete="new-password" required />
            </label>
            {params.error ? <p className="auth-error">{errorMessages[params.error] || 'No pude cambiar la clave.'}</p> : null}
            <button className="primary login-submit">Guardar</button>
          </form>
        </section>
      </div>
    </main>
  );
}
