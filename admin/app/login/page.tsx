export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const params = await searchParams;

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
            <label>
              Clave
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {params.error ? <p className="auth-error">Correo o clave incorrectos.</p> : null}
            {params.reset ? <p className="auth-note">Clave actualizada. Inicia sesion de nuevo.</p> : null}
            <button className="primary login-submit">Ingresar</button>
          </form>
          <div className="login-links">
            <a href="/forgot-password">Olvide mi clave</a>
          </div>
        </section>
      </div>
    </main>
  );
}
