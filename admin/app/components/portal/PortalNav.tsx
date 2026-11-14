'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Navegacion del portal: barra fija abajo en celular, pestanas arriba en
// pantallas anchas. Cuatro destinos, siempre los mismos y en el mismo orden.

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={path} />
  </svg>
);

const ITEMS = [
  { href: '/mi-perfil', label: 'Inicio', icon: icon('M4 11.5 12 4l8 7.5M6.5 10v9h11v-9') },
  { href: '/mi-perfil/musica', label: 'Mi música', icon: icon('M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z') },
  { href: '/mi-perfil/pagina', label: 'Mi página', icon: icon('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c.6-3.4 3.4-5.5 7-5.5s6.4 2.1 7 5.5') },
  { href: '/mi-perfil/estadisticas', label: 'Estadísticas', icon: icon('M5 20v-6M12 20V5M19 20v-9') }
];

export function PortalNav() {
  const pathname = usePathname() || '/mi-perfil';

  return (
    <nav className="pt-nav" aria-label="Secciones de tu portal">
      {ITEMS.map(item => {
        const active = item.href === '/mi-perfil' ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`pt-nav-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
