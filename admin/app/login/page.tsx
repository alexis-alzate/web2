export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <main className="login">
      <section className="section login-card">
        <p className="eyebrow">Acceso privado</p>
        <h1 className="title" style={{ fontSize: '2.4rem' }}>Lujo Urban</h1>
        <form action="/api/login" method="post" style={{ display: 'grid', gap: 14, marginTop: 22 }}>
          <label>
            Usuario
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Clave
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {searchParams.error ? <p style={{ color: '#ff8b8b' }}>Usuario o clave incorrectos.</p> : null}
          <button className="primary">Entrar</button>
        </form>
      </section>
    </main>
  );
}
