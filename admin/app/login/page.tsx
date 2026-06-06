export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <main className="login">
      <div className="login-shell">
        <h1 className="title login-title">Lujo Urban</h1>
        <section className="section login-card">
          <p className="eyebrow">Acceso privado</p>
          <form action="/api/login" method="post" className="login-form">
            <label>
              Usuario
              <input name="username" autoComplete="username" required />
            </label>
            <label>
              Clave
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {params.error ? <p style={{ color: '#ff8b8b' }}>Usuario o clave incorrectos.</p> : null}
            <button className="primary login-submit">Ingresar</button>
          </form>
        </section>
      </div>
    </main>
  );
}
