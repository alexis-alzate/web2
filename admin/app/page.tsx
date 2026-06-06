import { readJson } from '@/lib/github';
import {
  addArtistReleaseAction,
  createHomeReleaseAction,
  deleteArtistAction,
  moveArtistAction,
  reactivateArtistReleaseAction,
  saveArtistAction,
  reactivateHomeReleaseAction
} from './actions';
import { isAuthenticated } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SubmitButton } from './components/SubmitButton';
import { PasskeyRegisterButton } from './components/PasskeyRegisterButton';

type Artist = {
  name: string;
  cardName?: string;
  slug: string;
  role: string;
  tagline: string;
  bio?: string;
  photo?: string;
  links?: Record<string, string>;
  release?: {
    title: string;
    slug: string;
    link: string;
    cover?: string;
  } | null;
  beatsEmbed?: string;
  productionsEmbed?: string;
  contact?: { label?: string; url?: string } | null;
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

type ArtistReleaseHistory = {
  artists: Record<string, NonNullable<Artist['release']>[]>;
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
  let artistReleaseHistory: ArtistReleaseHistory;

  try {
    [artistData, releaseHistory, artistReleaseHistory] = await Promise.all([
      readJson<ArtistData>('artist-data.json', { artists: [] }),
      readJson<ReleaseHistory>('release-history.json', { releases: [] }),
      readJson<ArtistReleaseHistory>('artist-release-history.json', { artists: {} })
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
            Revisa que existan las variables NEXT_PUBLIC_SUPABASE_URL,
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, GITHUB_TOKEN, GITHUB_OWNER,
            GITHUB_REPO y GITHUB_BRANCH.
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
        <div className="auth-settings">
          <div>
            <strong>Huella / Passkey</strong>
            <p className="muted">Registrala una vez en este celular o computador para entrar mas rapido despues.</p>
          </div>
          <PasskeyRegisterButton />
        </div>
      </section>

      <section className="section">
        <details className="folder" open>
          <summary>
            <span>
              <strong>Lanzamientos Zaetta</strong>
              <small>{releaseHistory.releases.length} lanzamiento(s) guardado(s)</small>
            </span>
          </summary>
          <div className="folder-body">
            <details className="subfolder">
              <summary>Crear nuevo lanzamiento</summary>
              <form action={createHomeReleaseAction} className="grid">
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
                <SubmitButton className="primary span-2" pendingText="Creando lanzamiento...">
                  Crear lanzamiento de Zaetta
                </SubmitButton>
              </form>
            </details>
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
                    <p className="muted clamp-url">{release.shareUrl}</p>
                  </div>
                  <div className="actions">
                    <a className="button" href={release.link} target="_blank" rel="noreferrer">Abrir</a>
                    <form action={reactivateHomeReleaseAction}>
                      <input name="slug" type="hidden" value={release.slug} />
                      <SubmitButton pendingText="Reactivando...">Reactivar</SubmitButton>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </details>
      </section>

      <section className="section">
        <details className="folder" open>
          <summary>
            <span>
              <strong>Artistas</strong>
              <small>{artistData.artists.length} artista(s) en el roster</small>
            </span>
          </summary>
          <div className="folder-body">
            <details className="subfolder">
              <summary>Crear nuevo artista</summary>
              <form action={saveArtistAction} className="grid">
                <label>
                  Nombre publico
                  <input name="name" placeholder="EL SIERVO JHON" required />
                </label>
                <label>
                  Slug
                  <input name="slug" placeholder="siervo-jhon" />
                </label>
                <label>
                  Nombre tarjeta
                  <input name="cardName" placeholder="El Siervo Jhon" />
                </label>
                <label>
                  Rol
                  <input name="role" defaultValue="Artista oficial" />
                </label>
                <label className="span-2">
                  Frase corta
                  <input name="tagline" defaultValue="Música con identidad, visión y propósito." />
                </label>
                <label className="span-2">
                  Bio
                  <textarea name="bio" rows={3} placeholder="Perfil oficial dentro del ecosistema Lujo Urban." />
                </label>
                <label className="span-2">
                  Foto ya subida
                  <input name="photo" placeholder="assets/artista-photo.jpg" />
                </label>
                <label>
                  Spotify
                  <input name="spotify" placeholder="https://open.spotify.com/..." />
                </label>
                <label>
                  TikTok
                  <input name="tiktok" placeholder="https://www.tiktok.com/..." />
                </label>
                <label>
                  Instagram
                  <input name="instagram" placeholder="https://www.instagram.com/..." />
                </label>
                <label>
                  YouTube
                  <input name="youtube" placeholder="https://youtube.com/..." />
                </label>
                <label>
                  Facebook
                  <input name="facebook" placeholder="https://facebook.com/..." />
                </label>
                <label>
                  WhatsApp
                  <input name="whatsapp" placeholder="https://wa.me/..." />
                </label>
                <label className="span-2">
                  Embed beats
                  <input name="beatsEmbed" placeholder="https://open.spotify.com/embed/... o BeatStars" />
                </label>
                <label className="span-2">
                  Embed producciones
                  <input name="productionsEmbed" placeholder="https://open.spotify.com/embed/..." />
                </label>
                <label>
                  Texto contacto
                  <input name="contactLabel" placeholder="Booking" />
                </label>
                <label>
                  Link contacto
                  <input name="contactUrl" placeholder="https://wa.me/..." />
                </label>
                <SubmitButton className="primary span-2" pendingText="Guardando artista...">
                  Crear artista
                </SubmitButton>
              </form>
            </details>

            <div className="cards">
              {artistData.artists.map((artist, index) => (
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
                    <details className="inline-details">
                      <summary className="button">Editar</summary>
                      <form action={saveArtistAction} className="mini-form">
                    <input name="originalSlug" type="hidden" value={artist.slug} />
                    <label>
                      Nombre publico
                      <input name="name" defaultValue={artist.name} required />
                    </label>
                    <label>
                      Slug
                      <input name="slug" defaultValue={artist.slug} />
                    </label>
                    <label>
                      Nombre tarjeta
                      <input name="cardName" defaultValue={artist.cardName || ''} />
                    </label>
                    <label>
                      Rol
                      <input name="role" defaultValue={artist.role} />
                    </label>
                    <label>
                      Frase corta
                      <input name="tagline" defaultValue={artist.tagline} />
                    </label>
                    <label>
                      Bio
                      <textarea name="bio" rows={3} defaultValue={artist.bio || ''} />
                    </label>
                    <label>
                      Foto
                      <input name="photo" defaultValue={artist.photo || ''} />
                    </label>
                    {['spotify', 'tiktok', 'instagram', 'youtube', 'facebook', 'whatsapp'].map(key => (
                      <label key={key}>
                        {key}
                        <input name={key} defaultValue={artist.links?.[key] || ''} />
                      </label>
                    ))}
                    <label>
                      Embed beats
                      <input name="beatsEmbed" defaultValue={artist.beatsEmbed || ''} />
                    </label>
                    <label>
                      Embed producciones
                      <input name="productionsEmbed" defaultValue={artist.productionsEmbed || ''} />
                    </label>
                    <label>
                      Texto contacto
                      <input name="contactLabel" defaultValue={artist.contact?.label || ''} />
                    </label>
                    <label>
                      Link contacto
                      <input name="contactUrl" defaultValue={artist.contact?.url || ''} />
                    </label>
                    <SubmitButton className="primary" pendingText="Guardando...">Guardar</SubmitButton>
                  </form>
                </details>
                <form action={moveArtistAction}>
                  <input name="slug" type="hidden" value={artist.slug} />
                  <input name="direction" type="hidden" value="up" />
                  <SubmitButton disabled={index === 0} pendingText="Subiendo...">Subir</SubmitButton>
                </form>
                <form action={moveArtistAction}>
                  <input name="slug" type="hidden" value={artist.slug} />
                  <input name="direction" type="hidden" value="down" />
                  <SubmitButton disabled={index === artistData.artists.length - 1} pendingText="Bajando...">Bajar</SubmitButton>
                </form>
                <details className="inline-details">
                  <summary className="button danger">Borrar</summary>
                  <form action={deleteArtistAction} className="mini-form">
                    <input name="slug" type="hidden" value={artist.slug} />
                    <label>
                      Escribe BORRAR
                      <input name="confirmation" placeholder="BORRAR" />
                    </label>
                    <SubmitButton className="danger" pendingText="Borrando...">Borrar artista</SubmitButton>
                  </form>
                </details>
              </div>
            </article>
          ))}
            </div>
          </div>
        </details>
      </section>

      <section className="section">
        <details className="folder">
          <summary>
            <span>
              <strong>Lanzamientos de artistas</strong>
              <small>Publicar o reactivar canciones del roster</small>
            </span>
          </summary>
          <div className="folder-body">
            <details className="subfolder" open>
              <summary>Publicar lanzamiento de artista</summary>
              <form action={addArtistReleaseAction} className="grid">
                <label>
                  Artista
                  <select name="artistSlug" required>
                    <option value="">Seleccionar</option>
                    {artistData.artists.map(artist => (
                      <option key={artist.slug} value={artist.slug}>{artist.cardName || artist.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Nombre lanzamiento
                  <input name="title" required />
                </label>
                <label>
                  Slug lanzamiento
                  <input name="slug" placeholder="automatico" />
                </label>
                <label>
                  Portada ya subida
                  <input name="cover" placeholder="assets/artista-cancion-cover.jpg" />
                </label>
                <label className="span-2">
                  Link escuchar
                  <input name="link" placeholder="Spotify, Too Lost, Too.fm..." required />
                </label>
                <SubmitButton className="primary span-2" pendingText="Publicando lanzamiento...">
                  Publicar lanzamiento de artista
                </SubmitButton>
              </form>
            </details>

            <div className="cards">
              {artistData.artists.map(artist => {
                const releases = artistReleaseHistory.artists[artist.slug] || [];
                return (
                  <article className="card" key={`${artist.slug}-releases`}>
                    {artist.photo ? (
                      <img className="thumb" src={`https://www.lujourban.com/${artist.photo}`} alt="" />
                    ) : (
                      <div className="thumb placeholder">{initials(artist.name)}</div>
                    )}
                    <div>
                      <h3>{artist.cardName || artist.name}</h3>
                      <p className="muted">{releases.length ? `${releases.length} lanzamiento(s) guardado(s)` : 'Sin historial de lanzamientos'}</p>
                    </div>
                    <div className="actions">
                      {releases.map(release => (
                        <form action={reactivateArtistReleaseAction} key={release.slug || release.title}>
                          <input name="artistSlug" type="hidden" value={artist.slug} />
                          <input name="releaseSlug" type="hidden" value={release.slug || ''} />
                          <SubmitButton pendingText="Reactivando...">{release.title}</SubmitButton>
                        </form>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </details>
      </section>
    </main>
  );
}
