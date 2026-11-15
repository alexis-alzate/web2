'use client';

import { useCart } from '../providers/CartProvider';

// Cabecera del catálogo general de Lujo Urban (nav + hero). No se muestra dentro de
// la tienda de un productor: ahí la tienda es del productor y no lleva el contacto
// ni el mensaje de la plataforma.
export default function MarketplaceTop() {
  const { scopeSlug } = useCart();
  if (scopeSlug) return null;

  return (
    <div className="marketplace-top">
      <nav className="marketplace-nav" aria-label="Navegacion principal">
        <a href="https://www.lujourban.com" className="marketplace-logo" aria-label="Lujo Urban Beats">
          <span className="marketplace-logo-text">LUJO<span>URBAN</span></span>
          <span className="marketplace-logo-tag">Beats</span>
        </a>
        <div className="marketplace-links">
          <a href="#tienda">Licencias</a>
          <a href="https://www.lujourban.com/servicios/">Servicios</a>
          <a href="https://www.lujourban.com">Blog</a>
          <a href="mailto:zaetaalex@gmail.com">Contacto</a>
        </div>
        <a href="#tienda" className="marketplace-buy-link">Comprar beats</a>
      </nav>

      <section className="marketplace-hero" aria-labelledby="marketplace-title">
        <div className="marketplace-hero-inner">
          <h1 id="marketplace-title">Marcando el ritmo de tu próximo hit</h1>
          <p>Escoge tus ritmos, revisalos y en minutos los tienes en tu correo, listos para usar.</p>
        </div>
      </section>
    </div>
  );
}
