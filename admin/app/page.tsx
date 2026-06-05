import { readJson } from '@/lib/github';
import { createHomeReleaseAction, reactivateHomeReleaseAction } from './actions';
import { isAuthenticated } from '@/lib/auth';
import { redirect } from 'next/navigation';

type Artist = {
  name: string;
  cardName?: string;
  slug: string;
  role: string;
  tagline: string;
  photo?: string;
  links?: Record<string, string>;
  release?: {
    title: string;
    slug: string;
    link: string;
    cover?: string;
  } | null;
};

type ArtistData = {
  artists: Artist[];
};

type Release = {
  title: string;
  slug: string;
  cover: string;
  link: string;
  shareUrl: string;
};

type ReleaseHistory = {
  releases: Release[];
};

const initials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0])
  .join('');

export default async function DashboardPage() {
  if (!(await isAuthenticated())) redirect('/login');

  let artistData: ArtistData;
  let releaseHistory: ReleaseHistory;

  try {
    [artistData, releaseHistory] = await Promise.all([
      readJson<ArtistData>('artist-data.json', { artists: [] }),
      readJson<ReleaseHistory>('release-history.json', { releases: [] })
    ]);
  } catch (error) {
    return (
      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Panel privado</p>
            <h1 className="title">Lujo Urban</h1>
          </div>
        </header>
        <section className="section">
          <h2>Configuracion pendiente</h2>
          <p className="muted">{error instanceof Error ? error.message : 'No se pudo cargar la configuracion.'}</p>
          <p className="muted" style={{ marginTop: 12 }}>
            Revisa que exista <code>admin/.env.local</code> con ADMIN_USER, ADMIN_PASSWORD,
            ADMIN_SESSION_SECRET, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO y GITHUB_BRANCH.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Panel privado</p>
          <h1 className="title">Lujo Urban</h1>
        </div>
        <form action="/api/logout" method="post">
          <button>Salir</button>
        </form>
      </header>

      <section className="section">
        <h2>Estado</h2>
        <p className="muted">Panel online conectado a GitHub. Usuario unico, sin registro publico.</p>
      </section>

      <section className="section">
        <h2>Lanzamientos Zaetta</h2>
        <form action={createHomeReleaseAction} className="grid" style={{ marginBottom: 18 }}>
          <label className="span-2">
            Spotify de la cancion
            <input name="spotifyUrl" placeholder="https://open.spotify.com/track/..." required />
          </label>
          <label>
            Nombre visible
            <input name="title" placeholder="Automatico si Spotify lo entrega" />
          </label>
          <label>
            Slug
            <input name="slug" placeholder="nombre-corto" />
          </label>
          <label>
            Featuring WhatsApp
            <input name="featuring" placeholder="Opcional" />
          </label>
          <label>
            Version preview
            <input name="version" placeholder="Automatico" />
          </label>
          <label className="span-2">
            Link botones
            <input name="listenUrl" placeholder="too.fm o Spotify" />
          </label>
          <label className="span-2">
            Texto WhatsApp
            <input name="socialDescription" placeholder="Escucha..., el nuevo lanzamiento..." />
          </label>
          <label className="span-2">
            Texto hero
            <input name="heroText" defaultValue="Música con propósito. Sonidos que trascienden." />
          </label>
          <button className="primary span-2">Crear lanzamiento de Zaetta</button>
        </form>
        <div className="cards">
          {releaseHistory.releases.map(release => (
            <article className="card" key={release.slug}>
              {release.cover ? (
                <img className="thumb" src={`https://www.lujourban.com/${release.cover}`} alt="" />
              ) : (
                <div className="thumb placeholder">{initials(release.title)}</div>
              )}
              <div>
                <h3>{release.title}</h3>
                <p className="muted">{release.slug}</p>
                <p className="muted">{release.shareUrl}</p>
              </div>
              <div className="actions">
                <a className="button" href={release.link} target="_blank" rel="noreferrer">Abrir</a>
                <form action={reactivateHomeReleaseAction}>
                  <input name="slug" type="hidden" value={release.slug} />
                  <button>Reactivar</button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Artistas</h2>
        <div className="cards">
          {artistData.artists.map(artist => (
            <article className="card" key={artist.slug}>
              {artist.photo ? (
                <img className="thumb" src={`https://www.lujourban.com/${artist.photo}`} alt="" />
              ) : (
                <div className="thumb placeholder">{initials(artist.name)}</div>
              )}
              <div>
                <h3>{artist.cardName || artist.name}</h3>
                <p className="muted">{artist.slug}</p>
                <p className="muted">{artist.tagline}</p>
                {artist.release ? <p className="muted">Release activo: {artist.release.title}</p> : null}
              </div>
              <div className="actions">
                <a className="button" href={`https://www.lujourban.com/artistas/${artist.slug}/`} target="_blank" rel="noreferrer">Ver</a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
