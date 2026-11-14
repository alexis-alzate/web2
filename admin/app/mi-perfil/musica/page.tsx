import { MAX_RELEASE_TITLE_LENGTH } from '@/lib/artists';
import { pastReleasesOf, slugify, type ArtistRelease } from '@/lib/artist-renderer';
import { emptyArtistStats, getArtistStats } from '@/lib/artist-stats';
import { duplicatedReleaseLinks } from '@/lib/portal-todos';
import { MusicView, type MusicSong } from '../../components/portal/MusicView';
import { loadActivePortal, siteImage } from '../portal-data';

export default async function PortalMusicPage() {
  const portal = await loadActivePortal();
  if (!portal) return null;
  const { artist, releases, isTestAccount } = portal;

  const stats = isTestAccount ? emptyArtistStats() : await getArtistStats(artist.slug);
  const listens = new Map(stats.songs.map(song => [song.slug, song.listens]));
  const duplicated = duplicatedReleaseLinks(releases);

  const toSong = (release: ArtistRelease): MusicSong => {
    const slug = release.slug || slugify(release.title);
    return {
      ...release,
      slug,
      coverUrl: siteImage(release.cover),
      listens: listens.get(slug) ?? 0,
      sameLinkAs: duplicated.get(slug) ?? ''
    };
  };

  return (
    <MusicView
      current={artist.release ? toSong(artist.release) : null}
      past={pastReleasesOf(artist, releases).map(toSong)}
      maxTitleLength={MAX_RELEASE_TITLE_LENGTH}
      isTestAccount={isTestAccount}
    />
  );
}
