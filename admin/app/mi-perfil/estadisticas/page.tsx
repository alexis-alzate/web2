import { slugify } from '@/lib/artist-renderer';
import { emptyArtistStats, getArtistStats } from '@/lib/artist-stats';
import { StatsView, type StatsSong } from '../../components/portal/StatsView';
import { loadActivePortal, siteImage } from '../portal-data';

export default async function PortalStatsPage() {
  const portal = await loadActivePortal();
  if (!portal) return null;
  const { artist, releases, isTestAccount } = portal;

  // El slug sale de la sesion: un artista solo puede ver sus propios numeros.
  const stats = isTestAccount ? emptyArtistStats() : await getArtistStats(artist.slug);
  const listens = new Map(stats.songs.map(song => [song.slug, song.listens]));

  // Todas sus canciones, de la mas escuchada a la menos; las que no tuvieron
  // escuchas tambien salen, en cero.
  const songs: StatsSong[] = [...releases].reverse()
    .map(release => {
      const slug = release.slug || slugify(release.title);
      return { slug, title: release.title, coverUrl: siteImage(release.cover), listens: listens.get(slug) ?? 0 };
    })
    .sort((left, right) => right.listens - left.listens);

  return <StatsView stats={stats} songs={songs} isTestAccount={isTestAccount} />;
}
