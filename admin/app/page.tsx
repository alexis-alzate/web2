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
import { AutoLogoutTimer } from './components/AutoLogoutTimer';
import { ActionForm } from './components/ActionForm';
import { ReleasePreview } from './components/ReleasePreview';

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
  statusUrl?: string;
};

type ReleaseHistory = {
  releases: Release[];
};

type ArtistReleaseHistory = {
  artists: Record<string, NonNullable<Artist['release']>[]>;
};

type ModuleIconName = 'shield' | 'music' | 'users' | 'layers' | 'briefcase' | 'video' | 'chart';

const initials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0])
  .join('');

const ModuleIcon = ({ name }: { name: ModuleIconName }) => {
  const paths: Record<ModuleIconName, JSX.Element> = {
    shield: (
      <>
        <path d="M12 3 5.5 5.4v5.1c0 4.1 2.4 7.9 6.5 9.5 4.1-1.6 6.5-5.4 6.5-9.5V5.4L12 3Z" />
        <path d="m9.2 11.4 1.9 1.9 3.8-4" />
      </>
    ),
    music: (
      <>
        <path d="M9 18.2a2.6 2.6 0 1 1-1.4-2.3L9 15.2V6l9-2v10.2a2.6 2.6 0 1 1-1.4-2.3L18 11.2V4" />
        <path d="M9 8.2 18 6" />
      </>
    ),
    users: (
      <>
        <path d="M8.8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        <path d="M3.5 19c.5-3 2.4-4.5 5.3-4.5S13.6 16 14.1 19" />
        <path d="M15.5 11.3a2.4 2.4 0 1 0-1.1-4.6" />
        <path d="M15.8 14.5c2.3.2 3.8 1.7 4.2 4.5" />
      </>
    ),
    layers: (
      <>
        <path d="m12 4 8 4-8 4-8-4 8-4Z" />
        <path d="m4 12 8 4 8-4" />
        <path d="m4 16 8 4 8-4" />
      </>
    ),
    briefcase: (
      <>
        <path d="M8.5 7V5.8c0-1 .8-1.8 1.8-1.8h3.4c1 0 1.8.8 1.8 1.8V7" />
        <path d="M4.5 7h15v12h-15V7Z" />
        <path d="M4.5 11.2h15" />
      </>
    ),
    video: (
      <>
        <path d="M4.5 6.5h10v11h-10v-11Z" />
        <path d="m14.5 10 5-2.8v9.6l-5-2.8" />
      </>
    ),
    chart: (
      <>
        <path d="M5 19V9" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </>
    )
  };

  return (
    <span className="module-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        {paths[name]}
      </svg>
    </span>
  );
};

const futureModules = [
  {
    icon: 'briefcase' as const,
    title: 'Servicios',
    description: 'Ofertas, paquetes y procesos comerciales'
  },
  {
    icon: 'video' as const,
    title: 'Contenido',
    description: 'Videos, visualizers y material promocional'
  },
  {
    icon: 'chart' as const,
    title: 'Analiticas',
    description: 'Lecturas rapidas de trafico y conversiones'
  }
];

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
      <AutoLogoutTimer />
      <header className="topbar">
        <div className="topbar-title">
          <p className="eyebrow">Panel privado</p>
          <h1 className="title">Lujo Urban</h1>
        </div>
        <form action="/api/logout" method="post" className="logout-form">
          <button className="logout-button">Salir</button>
        </form>
      </header>

      <section className="section">
        <details className="folder">
          <summary>
            <span className="module-summary">
              <ModuleIcon name="shield" />
              <span>
                <strong>Estado</strong>
                <small>Panel privado activo</small>
              </span>
            </span>
          </summary>
          <div className="folder-body">
            <details className="subfolder">
              <summary>Panel activo</summary>
              <p className="muted">Conectado a GitHub. Acceso privado, sin registro publico.</p>
            </details>
            <details className="subfolder">
              <summary>Huella</summary>
              <div className="status-passkey">
                <p className="muted">Registra este dispositivo para entrar mas rapido despues.</p>
                <PasskeyRegisterButton />
              </div>
            </details>
          </div>
        </details>
      </section>

      <section className="section">
        <details className="folder">
          <summary>
            <span className="module-summary">
              <ModuleIcon name="music" />
              <span>
                <strong>Lanzamientos Zaetta</strong>
                <small>{releaseHistory.releases.length} lanzamiento(s) guardado(s)</small>
              </span>
            </span>
          </summary>
          <div className="folder-body">
            <details className="subfolder">
              <summary>Crear nuevo lanzamiento</summary>
              <ActionForm
                action={createHomeReleaseAction}
                className="grid"
                data-release-form
                savingMessage="Creando lanzamiento, generando preview social y publicando en GitHub..."
                successMessage="Lanzamiento publicado. Vercel empezara a desplegarlo."
                resetOnSuccess
              >
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
                <ReleasePreview />
                <SubmitButton className="primary span-2" pendingText="Creando lanzamiento...">
                  Crear lanzamiento de Zaetta
                </SubmitButton>
              </ActionForm>
            </details>
            <details className="subfolder">
              <summary>Lanzamientos guardados</summary>
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
                      <p className="muted clamp-url">Chat: {release.shareUrl}</p>
                      <p className="muted clamp-url">Estado: {release.statusUrl || release.shareUrl.replace('/lanzamientos/', '/estados/')}</p>
                    </div>
                    <div className="actions">
                      <a className="button" href={release.link} target="_blank" rel="noreferrer">Abrir</a>
                      <a className="button" href={release.shareUrl} target="_blank" rel="noreferrer">Chat</a>
                      <a className="button" href={release.statusUrl || release.shareUrl.replace('/lanzamientos/', '/estados/')} target="_blank" rel="noreferrer">Estado</a>
                      <ActionForm
                        action={reactivateHomeReleaseAction}
                        savingMessage={`Reactivando ${release.title} como lanzamiento principal...`}
                        successMessage={`${release.title} quedo activo como lanzamiento principal.`}
                      >
                        <input name="slug" type="hidden" value={release.slug} />
                        <SubmitButton pendingText="Reactivando...">Reactivar</SubmitButton>
                      </ActionForm>
                    </div>
                  </article>
                ))}
              </div>
            </details>
          </div>
        </details>
      </section>

      <section className="section">
        <details className="folder">
          <summary>
            <span className="module-summary">
              <ModuleIcon name="users" />
              <span>
                <strong>Artistas</strong>
                <small>{artistData.artists.length} artista(s) en el roster</small>
              </span>
            </span>
          </summary>
          <div className="folder-body">
            <details className="subfolder">
              <summary>Crear nuevo artista</summary>
              <ActionForm
                action={saveArtistAction}
                className="grid"
                savingMessage="Creando artista y publicando su pagina..."
                successMessage="Artista creado y publicado correctamente."
                resetOnSuccess
              >
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
              </ActionForm>
            </details>

            <details className="subfolder">
              <summary>Artistas guardados</summary>
              <div className="artist-folders">
                {artistData.artists.map((artist, index) => (
                  <details className="subfolder artist-folder" key={artist.slug}>
                    <summary>
                      <span className="artist-summary">
                        {artist.photo ? (
                          <img className="thumb" src={`https://www.lujourban.com/${artist.photo}`} alt="" />
                        ) : (
                          <span className="thumb placeholder">{initials(artist.name)}</span>
                        )}
                        <span>
                          <strong>{artist.cardName || artist.name}</strong>
                          <small>{artist.slug}</small>
                        </span>
                      </span>
                    </summary>
                    <div className="artist-folder-body">
                      <p className="muted">{artist.tagline}</p>
                      {artist.release ? <p className="muted">Release activo: {artist.release.title}</p> : null}
                      <div className="actions">
                        <a className="button" href={`https://www.lujourban.com/artistas/${artist.slug}/`} target="_blank" rel="noreferrer">Ver</a>
                        <details className="inline-details">
                          <summary className="button">Editar</summary>
                          <ActionForm
                            action={saveArtistAction}
                            className="mini-form"
                            savingMessage={`Guardando cambios de ${artist.cardName || artist.name}...`}
                            successMessage="Artista actualizado correctamente."
                          >
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
                          </ActionForm>
                        </details>
                        <ActionForm
                          action={moveArtistAction}
                          savingMessage={`Subiendo ${artist.cardName || artist.name} en el roster...`}
                          successMessage="Orden actualizado."
                        >
                          <input name="slug" type="hidden" value={artist.slug} />
                          <input name="direction" type="hidden" value="up" />
                          <SubmitButton disabled={index === 0} pendingText="Subiendo...">Subir</SubmitButton>
                        </ActionForm>
                        <ActionForm
                          action={moveArtistAction}
                          savingMessage={`Bajando ${artist.cardName || artist.name} en el roster...`}
                          successMessage="Orden actualizado."
                        >
                          <input name="slug" type="hidden" value={artist.slug} />
                          <input name="direction" type="hidden" value="down" />
                          <SubmitButton disabled={index === artistData.artists.length - 1} pendingText="Bajando...">Bajar</SubmitButton>
                        </ActionForm>
                        <details className="inline-details">
                          <summary className="button danger">Borrar</summary>
                          <ActionForm
                            action={deleteArtistAction}
                            className="mini-form"
                            savingMessage={`Eliminando ${artist.cardName || artist.name} del roster...`}
                            successMessage="Artista eliminado correctamente."
                          >
                            <input name="slug" type="hidden" value={artist.slug} />
                            <label>
                              Escribe BORRAR
                              <input name="confirmation" placeholder="BORRAR" />
                            </label>
                            <SubmitButton className="danger" pendingText="Borrando...">Borrar artista</SubmitButton>
                          </ActionForm>
                        </details>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          </div>
        </details>
      </section>

      <section className="section">
        <details className="folder">
          <summary>
            <span className="module-summary">
              <ModuleIcon name="layers" />
              <span>
                <strong>Lanzamientos de artistas</strong>
                <small>Publicar o reactivar canciones del roster</small>
              </span>
            </span>
          </summary>
          <div className="folder-body">
            <details className="subfolder">
              <summary>Publicar lanzamiento de artista</summary>
              <ActionForm
                action={addArtistReleaseAction}
                className="grid"
                savingMessage="Publicando lanzamiento del artista..."
                successMessage="Lanzamiento del artista publicado correctamente."
                resetOnSuccess
              >
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
              </ActionForm>
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
                        <ActionForm
                          action={reactivateArtistReleaseAction}
                          key={release.slug || release.title}
                          savingMessage={`Reactivando ${release.title}...`}
                          successMessage={`${release.title} quedo activo para este artista.`}
                        >
                          <input name="artistSlug" type="hidden" value={artist.slug} />
                          <input name="releaseSlug" type="hidden" value={release.slug || ''} />
                          <SubmitButton pendingText="Reactivando...">{release.title}</SubmitButton>
                        </ActionForm>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </details>
      </section>

      {futureModules.map(module => (
        <section className="section future-section" key={module.title}>
          <div className="folder future-folder" aria-disabled="true">
            <div className="future-summary">
              <span className="module-summary">
                <ModuleIcon name={module.icon} />
                <span>
                  <strong>{module.title}</strong>
                  <small>{module.description}</small>
                </span>
              </span>
            </div>
          </div>
        </section>
      ))}

      <footer className="admin-footer">
        <span>Lujo Urban Admin</span>
        <span>v1</span>
      </footer>
    </main>
  );
}
