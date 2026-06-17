import type { Metadata } from 'next';
import { Suspense } from 'react';
import Script from 'next/script';
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
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-VGKG8CCY6L" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-VGKG8CCY6L');
          `}
        </Script>
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "wziogq92mh");
          `}
        </Script>
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '670742718071367');
            fbq('track', 'PageView');
          `}
        </Script>
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
              ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
              for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
              ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;
              ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
              n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;
              e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
              ttq.load('D857IOBC77U70JIQN4BG');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=670742718071367&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
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
