import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Bebas_Neue, Inter, Barlow_Condensed } from 'next/font/google';
import { CartProvider } from './providers/CartProvider';
import { PlayerProvider } from './providers/PlayerProvider';
import Header from './components/Header';
import CartDrawer from './components/CartDrawer';
import PlayerBar from './components/PlayerBar';
import { MailIcon, TagIcon, ShieldCheckIcon } from './components/Icons';
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
                  <span className="marketplace-logo-mark">LU</span>
                  <span>BEATS</span>
                </a>
                <div className="marketplace-links">
                  <a href="#tienda">Licencias</a>
                  <a href="https://www.lujourban.com/servicios/">Servicios</a>
                  <a href="https://www.lujourban.com">Blog</a>
                  <a href="mailto:zaetaalex@gmail.com">Contacto</a>
                </div>
                <a href="#tienda" className="marketplace-buy-link">Comprar beats</a>
              </nav>

              <div className="marketplace-marquee" aria-hidden="true">
                <div className="marketplace-marquee-track">
                  <span>Beats</span>
                  <i />
                  <span>Sonido urbano</span>
                  <i />
                  <span>Licencias</span>
                </div>
              </div>

              <section className="marketplace-hero" aria-labelledby="marketplace-title">
                <div className="marketplace-hero-inner">
                  <h1 id="marketplace-title">Marca tu ritmo</h1>
                  <p>Beats urbanos listos para tu próxima canción.</p>
                  <a href="https://wa.me/573002400084?text=Hola%20Zaetta%2C%20busco%20un%20ritmo%20especifico." className="marketplace-help-link" target="_blank" rel="noopener">
                    ¿Buscas un ritmo especifico?
                  </a>
                  <div className="marketplace-offers" aria-label="Beneficios">
                    <a href="#tienda"><span><MailIcon /></span>Entrega</a>
                    <a href="#tienda"><span><TagIcon /></span>Licencias</a>
                    <a href="#tienda"><span><ShieldCheckIcon /></span>Pago seguro</a>
                  </div>
                </div>
              </section>
            </div>

            <div id="tienda" className="tienda-frame">
              <Suspense fallback={null}>
                <Header />
              </Suspense>
              <div className="site-header-divider" />
              {children}
              <PlayerBar />
            </div>
            <CartDrawer />
          </CartProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
