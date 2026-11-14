import '@fontsource/bebas-neue/400.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import './portal.css';

import type { ReactNode } from 'react';
import { publicArtistUrl } from '@/lib/artists/short-link';
import { AutoLogoutTimer } from '../components/AutoLogoutTimer';
import { PortalActivityTracker } from '../components/PortalActivityTracker';
import { PortalNav } from '../components/portal/PortalNav';
import { loadPortal, siteImage } from './portal-data';

const statusCopy = {
  suspended: {
    title: 'Tu acceso está pausado',
    message: 'No puedes editar mientras el acceso esté pausado. Tu página pública sigue igual. Escríbele a Lujo Urban para reactivarlo.'
  },
  inactive: {
    title: 'Tu acceso todavía no está activo',
    message: 'Lujo Urban debe activar esta cuenta antes de que puedas editar tu perfil.'
  }
} as const;

export default async function ArtistPortalLayout({ children }: { children: ReactNode }) {
  const { artist, status, isTestAccount } = await loadPortal();
  const blocked = !artist
    ? { title: 'No encontramos tu perfil', message: 'Tu usuario existe, pero el perfil vinculado ya no está en el roster. Escríbele a Lujo Urban.' }
    : status !== 'active' ? statusCopy[status] : null;

  return (
    <div className="pt">
      <AutoLogoutTimer />
      <PortalActivityTracker />

      <header className="pt-top">
        <div className="pt-id">
          {artist?.photo
            ? <img className="pt-id-photo" src={siteImage(artist.photo)} alt="" width="44" height="44" />
            : <span className="pt-id-photo pt-id-initials" aria-hidden="true">{(artist?.name || 'LU').slice(0, 2)}</span>}
          <div className="pt-id-text">
            <strong>{artist ? artist.cardName || artist.name : 'Lujo Urban'}</strong>
            {artist && !isTestAccount
              ? <a href={publicArtistUrl(artist)} target="_blank" rel="noreferrer">Ver mi página</a>
              : <span>{isTestAccount ? 'Cuenta de prueba' : 'Portal del artista'}</span>}
          </div>
        </div>
        <form action="/api/logout" method="post"><button className="pt-logout">Salir</button></form>
      </header>

      {blocked ? (
        <main className="pt-main">
          <section className="pt-blocked">
            <h1>{blocked.title}</h1>
            <p>{blocked.message}</p>
          </section>
        </main>
      ) : (
        <>
          <PortalNav />
          <main className="pt-main">
            {isTestAccount ? (
              <p className="pt-test">Estás en la cuenta de prueba. Puedes tocar todo: nada de aquí cambia ni publica la página de un artista real.</p>
            ) : null}
            {children}
          </main>
        </>
      )}
    </div>
  );
}
