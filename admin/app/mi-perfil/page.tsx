import { emptyArtistStats, getArtistStats } from '@/lib/artist-stats';
import { publicArtistUrl } from '@/lib/artists/short-link';
import { portalTodos } from '@/lib/portal-todos';
import { HomeView } from '../components/portal/HomeView';
import { loadActivePortal, siteImage } from './portal-data';

export default async function PortalHomePage() {
  const portal = await loadActivePortal();
  if (!portal) return null;
  const { artist, releases, isTestAccount } = portal;

  // El slug sale de la sesion: un artista solo puede ver sus propios numeros.
  const stats = isTestAccount ? emptyArtistStats() : await getArtistStats(artist.slug);

  return (
    <HomeView
      artist={artist}
      stats={stats}
      todos={portalTodos(artist, releases)}
      publicUrl={publicArtistUrl(artist)}
      coverUrl={siteImage(artist.release?.cover)}
      isTestAccount={isTestAccount}
    />
  );
}
