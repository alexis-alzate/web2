import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Bebas_Neue, Inter, Barlow_Condensed } from 'next/font/google';
import { CartProvider } from './providers/CartProvider';
import { PlayerProvider } from './providers/PlayerProvider';
import Header from './components/Header';
import CartDrawer from './components/CartDrawer';
import PlayerBar from './components/PlayerBar';
import './globals.css';

const bebas = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-bebas' });
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-inter' });
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-barlow-condensed'
});

export const metadata: Metadata = {
  metadataBase: new URL('https://tienda.lujourban.com'),
  title: 'Tienda de Beats — Lujo Urban',
  description: 'Beats originales de Zaetta. Escucha el preview, elige tu licencia y descarga al instante.',
  robots: 'index, follow'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${bebas.variable} ${inter.variable} ${barlowCondensed.variable}`}>
      <body>
        <PlayerProvider>
          <CartProvider>
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

            <div id="tienda" className="tienda-frame">
              <Suspense fallback={null}>
                <Header />
              </Suspense>
              <div className="site-header-divider" />
              {children}
              <CartDrawer />
              <PlayerBar />
            </div>
          </CartProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
