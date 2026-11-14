import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { Artist, ArtistRelease } from '@/lib/artist-renderer';
import { artistService } from '@/lib/artists';
import { getCurrentAccess, type LujoAccessStatus } from '@/lib/auth';
import { readTestArtist, TEST_ARTIST_SLUG } from '@/lib/test-artist';

// Lo que necesita cualquier pantalla del portal. El layout y cada pagina
// llaman a `loadPortal()`; `cache` hace que en una misma peticion se lea una
// sola vez. La comprobacion de acceso va AQUI (no solo en el layout) para que
// ninguna pagina pueda mostrarse sin pasar por ella.

export type PortalContext = {
  isTestAccount: boolean;
  status: LujoAccessStatus;
  // null = el usuario existe pero su perfil ya no esta en el roster.
  artist: Artist | null;
  // Historial del mas viejo al mas nuevo (incluye la cancion actual).
  releases: ArtistRelease[];
};

export const loadPortal = cache(async (): Promise<PortalContext> => {
  const access = await getCurrentAccess();
  if (!access) redirect('/login');
  if (access.role === 'admin') redirect('/');
  if (access.role !== 'artist' || !access.artistSlug) redirect('/login?error=access');

  const isTestAccount = access.artistSlug === TEST_ARTIST_SLUG;
  if (isTestAccount) {
    const artist = readTestArtist(access.user.app_metadata?.lujo_test_profile);
    return { isTestAccount, status: access.status, artist, releases: artist.release ? [artist.release] : [] };
  }

  const record = await artistService.findArtistBySlug(access.artistSlug);
  return {
    isTestAccount,
    status: access.status,
    artist: record?.artist ?? null,
    releases: record?.releases ?? []
  };
});

// Para las paginas: solo devuelve cuando hay un artista activo. En cualquier
// otro caso el layout ya esta mostrando el aviso y la pagina no pinta nada.
export const loadActivePortal = async () => {
  const portal = await loadPortal();
  if (!portal.artist || portal.status !== 'active') return null;
  return { ...portal, artist: portal.artist };
};

export const siteImage = (path?: string | null) => (path ? `https://www.lujourban.com/${path}` : '');
