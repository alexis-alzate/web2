import '@fontsource/bebas-neue/400.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import '../mi-perfil/portal.css';
import './productor.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AutoLogoutTimer } from '../components/AutoLogoutTimer';
import { loadProducer } from './producer-data';

export const metadata: Metadata = {
  title: 'Portal del productor · Lujo Urban',
  robots: { index: false, follow: false }
};

const accessCopy = {
  suspended: {
    title: 'Tu acceso está pausado',
    message: 'No puedes entrar mientras el acceso esté pausado. Escríbele a Lujo Urban para reactivarlo.'
  },
  inactive: {
    title: 'Tu acceso todavía no está activo',
    message: 'Lujo Urban debe activar esta cuenta antes de que puedas usar el portal.'
  }
} as const;

export default async function ProducerPortalLayout({ children }: { children: ReactNode }) {
  const { profile, status } = await loadProducer();

  const blocked = !profile
    ? { title: 'No encontramos tu perfil', message: 'Tu usuario existe, pero el perfil de productor vinculado ya no está registrado. Escríbele a Lujo Urban.' }
    : status !== 'active'
      ? accessCopy[status]
      : profile.status !== 'active'
        ? { title: 'Tu perfil está desactivado', message: 'Tu perfil de productor está desactivado por ahora. Escríbele a Lujo Urban.' }
        : null;

  return (
    <div className="pt pt-prod">
      <AutoLogoutTimer />

      <header className="pt-top">
        <div className="pt-id">
          <span className="pt-id-photo pt-id-initials" aria-hidden="true">{(profile?.stageName || 'LU').slice(0, 2)}</span>
          <div className="pt-id-text">
            <strong>{profile?.stageName || 'Lujo Urban'}</strong>
            <span>Portal del productor</span>
          </div>
        </div>
        <form action="/api/logout" method="post"><button className="pt-logout">Salir</button></form>
      </header>

      <main className="pt-main">
        {blocked ? (
          <section className="pt-blocked">
            <h1>{blocked.title}</h1>
            <p>{blocked.message}</p>
          </section>
        ) : children}
      </main>
    </div>
  );
}
