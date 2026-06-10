import Link from 'next/link';

export default function Hero() {
  return (
    <section className="site-hero">
      <Link href="/" className="site-hero-brand">LUJO URBAN</Link>

      <h1 className="site-hero-title">Beats que le ponen ritmo a tu próximo hit</h1>

      <p className="site-hero-subtitle">
        Producción original de Zaetta. Escucha el preview, elige tu licencia y descarga al instante.
      </p>

      <span className="site-hero-promo">🎧 Nuevos beats cada semana</span>

      <div className="site-hero-actions">
        <a href="#tienda" className="site-hero-cta">Explorar beats</a>
      </div>
    </section>
  );
}
