import { updatePasswordAction } from '../auth-actions';
import { PasswordField } from '../components/PasswordField';

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
            <PasswordField label="Nueva clave" name="password" autoComplete="new-password" />
            <PasswordField label="Confirmar clave" name="confirmation" autoComplete="new-password" />
            {params.error ? <p className="auth-error">{errorMessages[params.error] || 'No pude cambiar la clave.'}</p> : null}
            <button className="primary login-submit">Guardar</button>
          </form>
        </section>
      </div>
    </main>
  );
}
