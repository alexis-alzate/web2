import { readJson } from '@/lib/github';
import {
  addArtistReleaseAction,
  addCasaCatalogPickAction,
  createHomeReleaseAction,
  deleteArtistAction,
  moveArtistAction,
  moveCasaCatalogPickAction,
  reactivateArtistReleaseAction,
  removeCasaCatalogPickAction,
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
import { CopyLinkButton } from './components/CopyLinkButton';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { getReleaseAnalyticsSummary, type ReleaseAnalyticsSummary } from '@/lib/analytics';
import { createBeatAction, deleteBeatAction, toggleBeatStatusAction, toggleDemoBeatsAction } from './actions-beats';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { beatCoverUrl, type Beat } from '@/lib/beats';

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

type CasaCatalogPick = {
  source: 'zaetta' | 'artist';
  artistSlug?: string;
  releaseSlug: string;
};

type CasaCatalogConfig = {
  picks: CasaCatalogPick[];
};

const emptyAnalyticsSummary = (error?: string): ReleaseAnalyticsSummary => ({
  totals: {
    view: 0,
    chat_click: 0,
    status_click: 0
  },
  interactionsTotal: 0,
  conversionRate: 0,
  releases: [],
  dailyStats: [],
  hasData: false,
  error
});

type ModuleIconName = 'shield' | 'music' | 'users' | 'layers' | 'briefcase' | 'video' | 'chart';

const initials = (name: string) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0])
  .join('');

const formatCOP = (value: number) => '$' + Number(value).toLocaleString('es-CO');

const resolveCasaCatalogPickLabel = (
  pick: CasaCatalogPick,
  artistData: ArtistData,
  releaseHistory: ReleaseHistory,
  artistReleaseHistory: ArtistReleaseHistory
) => {
  if (pick.source === 'artist') {
    const artist = artistData.artists.find(item => item.slug === pick.artistSlug);
    const release = (artistReleaseHistory.artists[pick.artistSlug || ''] || []).find(item => item.slug === pick.releaseSlug);
    return {
      title: release?.title || pick.releaseSlug,
      cover: release?.cover ? `https://www.lujourban.com/${release.cover.replace(/^\/+/, '')}` : '',
      sourceName: artist ? (artist.cardName || artist.name) : 'Artista'
    };
  }

  const release = releaseHistory.releases.find(item => item.slug === pick.releaseSlug);
  return {
    title: release?.title || pick.releaseSlug,
    cover: release?.cover ? `https://www.lujourban.com/${release.cover.replace(/^\/+/, '')}` : '',
    sourceName: 'Zaetta'
  };
};

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
  }
];

export default async function DashboardPage() {
  if (!(await isAuthenticated())) redirect('/login');

  let artistData: ArtistData;
  let releaseHistory: ReleaseHistory;
  let artistReleaseHistory: ArtistReleaseHistory;
  let casaCatalog: CasaCatalogConfig;
  let analyticsSummary: ReleaseAnalyticsSummary = emptyAnalyticsSummary();
  let beats: Beat[] = [];
  let showDemoBeats = true;

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: beatsData } = await supabaseAdmin
      .from('beats')
      .select('*')
      .order('created_at', { ascending: false });
    beats = (beatsData as Beat[]) || [];

    const { data: settingData } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'show_demo_beats')
      .maybeSingle();
    showDemoBeats = settingData?.value !== false;
  } catch {
    beats = [];
  }

  try {
    [artistData, releaseHistory, artistReleaseHistory, casaCatalog] = await Promise.all([
      readJson<ArtistData>('artist-data.json', { artists: [] }),
      readJson<ReleaseHistory>('release-history.json', { releases: [] }),
      readJson<ArtistReleaseHistory>('artist-release-history.json', { artists: {} }),
      readJson<CasaCatalogConfig>('casa-catalog.json', { picks: [] })
    ]);
    analyticsSummary = await getReleaseAnalyticsSummary();
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
                  <details className="card release-accordion" key={release.slug}>
                    <summary className="release-accordion-summary">
                      {release.cover ? (
                        <img className="thumb" src={`https://www.lujourban.com/${release.cover}`} alt="" />
                      ) : (
                        <div className="thumb placeholder">{initials(release.title)}</div>
                      )}
                      <div className="release-accordion-copy">
                        <h3>{release.title}</h3>
                        <p className="muted">{release.slug}</p>
                      </div>
                    </summary>
                    <div className="release-accordion-panel">
                      <div className="actions release-actions-admin">
                        <a className="button" href={release.link} target="_blank" rel="noreferrer">Abrir</a>
                        <CopyLinkButton
                          url={release.shareUrl}
                          title={`${release.title} - Zaetta`}
                          text={`Escucha ${release.title}, el nuevo lanzamiento de Zaetta.`}
                        >
                          Compartir chat
                        </CopyLinkButton>
                        <CopyLinkButton
                          url={release.statusUrl || release.shareUrl.replace('/lanzamientos/', '/estados/')}
                          title={`${release.title} - Zaetta`}
                          text={`Escucha ${release.title}, el nuevo lanzamiento de Zaetta.`}
                        >
                          Compartir estado
                        </CopyLinkButton>
                        <ActionForm
                          action={reactivateHomeReleaseAction}
                          savingMessage={`Reactivando ${release.title} como lanzamiento principal...`}
                          successMessage={`${release.title} quedo activo como lanzamiento principal.`}
                        >
                          <input name="slug" type="hidden" value={release.slug} />
                          <SubmitButton className="premium" pendingText="Reactivando...">Reactivar</SubmitButton>
                        </ActionForm>
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
                  Subir foto
                  <input name="photoFile" type="file" accept="image/*" />
                  <small>Usa una foto cuadrada (ej. 1000x1000px) para que se vea perfecta en todas las secciones.</small>
                </label>
                <label className="span-2">
                  Foto ya subida (si no subes una nueva)
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
                              Subir foto nueva
                              <input name="photoFile" type="file" accept="image/*" />
                              <small>Usa una foto cuadrada (ej. 1000x1000px) para que se vea perfecta en todas las secciones.</small>
                            </label>
                            <label>
                              Foto (si no subes una nueva)
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

      <section className="section">
        <details className="folder">
          <summary>
            <span className="module-summary">
              <ModuleIcon name="music" />
              <span>
                <strong>El catalogo (Casa)</strong>
                <small>Elige y ordena lo que aparece en "El catalogo" de la pagina Casa</small>
              </span>
            </span>
          </summary>
          <div className="folder-body">
            <p className="muted">
              Fija aqui, en orden, los lanzamientos que quieres mostrar en las tarjetas del catalogo
              (tuyos o del roster). Los espacios libres se completan automaticamente con tus
              lanzamientos mas recientes.
            </p>

            {casaCatalog.picks.length > 0 && (
              <ol className="cards catalog-picks">
                {casaCatalog.picks.map((pick, index) => {
                  const label = resolveCasaCatalogPickLabel(pick, artistData, releaseHistory, artistReleaseHistory);
                  return (
                    <li className="card" key={`${pick.source}-${pick.artistSlug || 'zaetta'}-${pick.releaseSlug}`}>
                      {label.cover ? (
                        <img className="thumb" src={label.cover} alt="" />
                      ) : (
                        <div className="thumb placeholder">{initials(label.title)}</div>
                      )}
                      <div>
                        <h3>{`${index + 1}. ${label.title}`}</h3>
                        <p className="muted">{label.sourceName}</p>
                      </div>
                      <div className="actions">
                        <ActionForm
                          action={moveCasaCatalogPickAction}
                          savingMessage="Moviendo lanzamiento..."
                          successMessage="Orden del catalogo actualizado."
                        >
                          <input name="index" type="hidden" value={index} />
                          <input name="direction" type="hidden" value="up" />
                          <SubmitButton pendingText="..." disabled={index === 0}>↑ Subir</SubmitButton>
                        </ActionForm>
                        <ActionForm
                          action={moveCasaCatalogPickAction}
                          savingMessage="Moviendo lanzamiento..."
                          successMessage="Orden del catalogo actualizado."
                        >
                          <input name="index" type="hidden" value={index} />
                          <input name="direction" type="hidden" value="down" />
                          <SubmitButton pendingText="..." disabled={index === casaCatalog.picks.length - 1}>↓ Bajar</SubmitButton>
                        </ActionForm>
                        <ActionForm
                          action={removeCasaCatalogPickAction}
                          savingMessage="Quitando del catalogo..."
                          successMessage={`${label.title} ya no esta fijo en el catalogo.`}
                        >
                          <input name="index" type="hidden" value={index} />
                          <SubmitButton className="danger" pendingText="Quitando...">Quitar</SubmitButton>
                        </ActionForm>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <details className="subfolder">
              <summary>Fijar lanzamiento en el catalogo</summary>
              <ActionForm
                action={addCasaCatalogPickAction}
                className="grid"
                savingMessage="Fijando lanzamiento en el catalogo..."
                successMessage="Lanzamiento fijado en el catalogo."
                resetOnSuccess
              >
                <label className="span-2">
                  Lanzamiento
                  <select name="pick" required>
                    <option value="">Seleccionar</option>
                    <optgroup label="Zaetta">
                      {releaseHistory.releases.map(release => (
                        <option key={`zaetta-${release.slug}`} value={`zaetta||${release.slug}`}>{release.title}</option>
                      ))}
                    </optgroup>
                    {artistData.artists.map(artist => {
                      const releases = artistReleaseHistory.artists[artist.slug] || [];
                      if (!releases.length) return null;
                      return (
                        <optgroup key={artist.slug} label={artist.cardName || artist.name}>
                          {releases.map(release => (
                            <option key={`${artist.slug}-${release.slug}`} value={`artist|${artist.slug}|${release.slug}`}>{release.title}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </label>
                <SubmitButton className="primary span-2" pendingText="Fijando...">
                  Fijar en el catalogo
                </SubmitButton>
              </ActionForm>
            </details>
          </div>
        </details>
      </section>

      <section className="section">
        <details className="folder">
          <summary>
            <span className="module-summary">
              <ModuleIcon name="briefcase" />
              <span>
                <strong>Tienda de beats</strong>
                <small>{beats.length} beat(s) publicado(s)</small>
              </span>
            </span>
          </summary>
          <div className="folder-body">
            <ActionForm
              action={toggleDemoBeatsAction}
              savingMessage="Actualizando vitrina..."
              successMessage="Configuracion de la vitrina actualizada."
            >
              <input name="current" type="hidden" value={String(showDemoBeats)} />
              <p className="muted">
                {showDemoBeats
                  ? 'La tienda esta mostrando 19 beats de prueba (duplicados de demostracion) ademas de los reales.'
                  : 'Los beats de prueba estan ocultos. La tienda solo muestra los beats reales publicados.'}
              </p>
              <SubmitButton pendingText="...">
                {showDemoBeats ? 'Ocultar beats de prueba' : 'Mostrar beats de prueba'}
              </SubmitButton>
            </ActionForm>

            {beats.length > 0 && (
              <ol className="cards catalog-picks">
                {beats.map((beat) => (
                  <li className="card" key={beat.id}>
                    {beat.cover_url ? (
                      <img className="thumb" src={beatCoverUrl(beat.cover_url)} alt="" />
                    ) : (
                      <div className="thumb placeholder">{initials(beat.title)}</div>
                    )}
                    <div>
                      <h3>{beat.title}</h3>
                      <p className="muted">
                        {[beat.genre, beat.bpm ? `${beat.bpm} BPM` : null, beat.key]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="muted">
                        Básica {formatCOP(beat.price_basic)} · Premium {formatCOP(beat.price_premium)} · Exclusiva {formatCOP(beat.price_exclusive)}
                      </p>
                    </div>
                    <div className="actions">
                      <ActionForm
                        action={toggleBeatStatusAction}
                        savingMessage="Actualizando estado..."
                        successMessage="Estado del beat actualizado."
                      >
                        <input name="id" type="hidden" value={beat.id} />
                        <input name="status" type="hidden" value={beat.status} />
                        <SubmitButton pendingText="...">
                          {beat.status === 'available' ? 'Marcar vendido (exclusiva)' : 'Marcar disponible'}
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm
                        action={deleteBeatAction}
                        savingMessage="Eliminando beat..."
                        successMessage="Beat eliminado."
                      >
                        <input name="id" type="hidden" value={beat.id} />
                        <SubmitButton className="danger" pendingText="Eliminando...">Eliminar</SubmitButton>
                      </ActionForm>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <details className="subfolder">
              <summary>Agregar beat nuevo</summary>
              <ActionForm
                action={createBeatAction}
                className="grid"
                savingMessage="Subiendo archivos y publicando el beat..."
                successMessage="Beat publicado en la tienda."
                resetOnSuccess
              >
                <label className="span-2">
                  Título
                  <input name="title" required placeholder="Nombre del beat" />
                </label>
                <label>
                  BPM
                  <input name="bpm" type="number" placeholder="88" />
                </label>
                <label>
                  Tonalidad (key)
                  <input name="key" placeholder="C minor" />
                </label>
                <label>
                  Género
                  <input name="genre" placeholder="Afrobeat" />
                </label>
                <label>
                  Tags (separados por coma)
                  <input name="tags" placeholder="afro dancehall, type beat" />
                </label>
                <label>
                  Precio licencia básica (COP)
                  <input name="price_basic" type="number" required placeholder="100000" />
                </label>
                <label>
                  Precio licencia premium (COP)
                  <input name="price_premium" type="number" required placeholder="200000" />
                </label>
                <label>
                  Precio licencia exclusiva (COP)
                  <input name="price_exclusive" type="number" required placeholder="400000" />
                </label>
                <label className="span-2">
                  Carátula (imagen)
                  <input name="cover" type="file" accept="image/*" />
                </label>
                <label className="span-2">
                  Preview de audio
                  <input name="preview" type="file" accept="audio/*" />
                </label>
                <label>
                  Archivo licencia básica (MP3)
                  <input name="file_basic" type="file" accept="audio/*" />
                </label>
                <label>
                  Archivo licencia premium (WAV)
                  <input name="file_premium" type="file" accept="audio/*" />
                </label>
                <label>
                  Archivo licencia exclusiva (.zip con stems)
                  <input name="file_exclusive" type="file" accept=".zip,.rar,application/zip,application/x-zip-compressed" />
                  <small className="muted">Sube un comprimido con todos los tracks/stems del beat.</small>
                </label>
                <SubmitButton className="primary span-2" pendingText="Publicando...">
                  Publicar beat
                </SubmitButton>
              </ActionForm>
            </details>
          </div>
        </details>
      </section>

      <section className="section">
        <details className="folder">
          <summary>
            <span className="module-summary">
              <ModuleIcon name="chart" />
              <span>
                <strong>Analiticas</strong>
                <small>Visitas, clics y conversiones de lanzamientos</small>
              </span>
            </span>
          </summary>
          <div className="folder-body">
            <AnalyticsDashboard summary={analyticsSummary} releases={releaseHistory.releases} />
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
