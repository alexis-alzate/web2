// "Por hacer" del portal del artista: cosas concretas que le faltan a su
// pagina, cada una con el lugar donde se arregla. Es puro y tiene pruebas.

import type { Artist, ArtistRelease } from '@/lib/artist-renderer';
import { SOCIAL_KEYS } from '@/lib/socials';

export type PortalTodo = {
  key: string;
  text: string;
  href: string;
  action: string;
};

const IGNORED_PARAMS = /^(si|feature|fbclid|igshid|igsh|utm_.*)$/i;

// Dos enlaces son "el mismo" si llevan al mismo sitio, aunque cambien los
// parametros de seguimiento que agregan YouTube, Spotify o Instagram.
export const comparableLink = (value: string | undefined | null): string => {
  try {
    const url = new URL(String(value || '').trim());
    const params = Array.from(url.searchParams.entries())
      .filter(([key]) => !IGNORED_PARAMS.test(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}=${item}`)
      .join('&');
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return `${host}${url.pathname.replace(/\/+$/, '')}${params ? `?${params}` : ''}`;
  } catch {
    return '';
  }
};

// Slugs de las canciones que comparten enlace con otra.
export const duplicatedReleaseLinks = (releases: ArtistRelease[]): Map<string, string> => {
  const byLink = new Map<string, ArtistRelease[]>();
  for (const release of releases) {
    const key = comparableLink(release.link);
    if (!key) continue;
    byLink.set(key, [...(byLink.get(key) ?? []), release]);
  }

  // slug -> titulo de la otra cancion con el mismo enlace.
  const duplicated = new Map<string, string>();
  for (const group of byLink.values()) {
    if (group.length < 2) continue;
    group.forEach((release, index) => {
      const other = group[index === 0 ? 1 : 0];
      if (release.slug) duplicated.set(release.slug, other.title);
    });
  }
  return duplicated;
};

export const portalTodos = (artist: Artist, releases: ArtistRelease[]): PortalTodo[] => {
  const todos: PortalTodo[] = [];

  if (!artist.photo) {
    todos.push({ key: 'photo', text: 'Tu página no tiene foto de perfil.', href: '/mi-perfil/pagina', action: 'Subir foto' });
  }

  if (!artist.release) {
    todos.push({ key: 'release', text: 'Todavía no has publicado una canción.', href: '/mi-perfil/musica', action: 'Publicar' });
  } else if (!artist.release.cover) {
    todos.push({
      key: 'cover',
      text: `«${artist.release.title}» no tiene portada.`,
      href: '/mi-perfil/musica',
      action: 'Agregar portada'
    });
  }

  const duplicated = duplicatedReleaseLinks(releases);
  const firstDuplicated = releases.find(release => release.slug && duplicated.has(release.slug));
  if (firstDuplicated?.slug) {
    todos.push({
      key: 'duplicate-link',
      text: `«${firstDuplicated.title}» y «${duplicated.get(firstDuplicated.slug)}» llevan al mismo enlace.`,
      href: '/mi-perfil/musica',
      action: 'Corregir'
    });
  }

  const linkCount = SOCIAL_KEYS.filter(key => artist.links?.[key]?.trim()).length;
  if (linkCount < 2) {
    todos.push({
      key: 'links',
      text: linkCount === 0 ? 'No has agregado ninguna red ni plataforma.' : 'Solo tienes una red en tu página.',
      href: '/mi-perfil/pagina',
      action: 'Agregar redes'
    });
  }

  return todos;
};
