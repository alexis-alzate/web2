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
import { getCurrentAccess } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SubmitButton } from './components/SubmitButton';
import { PasskeyRegisterButton } from './components/PasskeyRegisterButton';
import { AutoLogoutTimer } from './components/AutoLogoutTimer';
import { ActionForm } from './components/ActionForm';
import { SocialOrderEditor } from './components/SocialOrderEditor';
import { ReleasePreview } from './components/ReleasePreview';
import { CopyLinkButton } from './components/CopyLinkButton';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { BeatUploadForm } from './components/BeatUploadForm';
import { BeatFilesUploadForm } from './components/BeatFilesUploadForm';
import { getReleaseAnalyticsSummary, type ReleaseAnalyticsSummary } from '@/lib/analytics';
import { deleteBeatAction, toggleBeatStatusAction, toggleDemoBeatsAction, updateBeatMetadataAction } from './actions-beats';
import { resendOrderEmailAction } from './actions-orders';
import { createProducerAction, toggleProducerStatusAction } from './actions-producers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { beatCoverUrl, LICENSE_LABELS, type Beat, type LicenseType, type Producer } from '@/lib/beats';
import type { SocialKey } from '@/lib/socials';
import { isAccessStatus, type LujoAccessStatus } from '@/lib/auth';
import { TEST_ARTIST_SLUG } from '@/lib/test-artist';
import {
  convertArtistUserToTestAction,
  createTestArtistUserAction,
  inviteArtistUserAction,
  unlinkArtistUserAction,
  updateArtistUserAccessAction
} from './artist-access-actions';

type BeatOrder = {
  id: string;
  buyer_email: string;
  total_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  order_items: { license_type: LicenseType; amount: number; beats: { title: string } | null }[];
};

type BeatOffer = {
  id: string;
  beat_title: string;
  beat_slug: string;
  full_name: string;
  email: string;
  amount: string;
  message: string | null;
  status: 'new' | 'contacted' | 'accepted' | 'rejected' | 'closed';
  created_at: string;
};

type ProducerEarning = {
  id: string;
  gross_amount: number;
  platform_fee_amount: number;
  producer_amount: number;
  status: 'pending' | 'paid' | 'cancelled';
  producer_notified_at: string | null;
  created_at: string;
  producers: { stage_name: string; email: string } | null;
  beats: { title: string } | null;
};

const ORDER_STATUS_LABELS: Record<BeatOrder['status'], string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada'
};

const OFFER_STATUS_LABELS: Record<BeatOffer['status'], string> = {
  new: 'Nueva',
  contacted: 'Contactada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  closed: 'Cerrada'
};

type Artist = {
  name: string;
  cardName?: string;
  slug: string;
  role: string;
  tagline: string;
  bio?: string;
  photo?: string;
  links?: Record<string, string>;
  socialOrder?: SocialKey[];
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

type ArtistAccessAccount = {
  id: string;
  email: string;
  artistSlug: string;
  status: LujoAccessStatus;
  confirmed: boolean;
  unlinkedAt: string;
};

const ACCESS_STATUS_LABELS: Record<LujoAccessStatus, string> = {
  active: 'Activo',
  suspended: 'Pausado',
  inactive: 'Inactivo'
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

type AnalyticsRelease = {
  title: string;
  slug: string;
  cover?: string;
  artistSlug?: string | null;
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
  interactionRate: 0,
  releases: [],
  previous: {
    views: 0,
    interactions: 0,
    interactionRate: 0
  },
  dailyStats: [],
  periodDays: 15,
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
  const access = await getCurrentAccess();
  if (!access) redirect('/login');
  if (access.role === 'artist') redirect('/mi-perfil');
  if (access.role !== 'admin' || access.status !== 'active') redirect('/login?error=access');

  let artistData: ArtistData;
  let releaseHistory: ReleaseHistory;
  let artistReleaseHistory: ArtistReleaseHistory;
  let casaCatalog: CasaCatalogConfig;
  let analyticsSummary: ReleaseAnalyticsSummary = emptyAnalyticsSummary();
  let analyticsReleases: AnalyticsRelease[] = [];
  let beats: Beat[] = [];
  let showDemoBeats = true;
  let beatOrders: BeatOrder[] = [];
  let beatOffers: BeatOffer[] = [];
  let producers: Producer[] = [];
  let producerEarnings: ProducerEarning[] = [];
  let artistAccessAccounts: ArtistAccessAccount[] = [];
  let artistAccessError = '';

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: beatsData } = await supabaseAdmin
      .from('beats')
      .select('*')
      .order('created_at', { ascending: false });
    beats = (beatsData as Beat[]) || [];

    const { data: producersData } = await supabaseAdmin
      .from('producers')
      .select('*')
      .order('stage_name', { ascending: true });
    producers = (producersData as Producer[]) || [];

    const { data: settingData } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'show_demo_beats')
      .maybeSingle();
    showDemoBeats = settingData?.value !== false;

    const { data: ordersData } = await supabaseAdmin
      .from('orders')
      .select('id, buyer_email, total_amount, status, created_at, order_items(license_type, amount, beats(title))')
      .order('created_at', { ascending: false })
      .limit(50);
    beatOrders = (ordersData as unknown as BeatOrder[]) || [];

    const { data: offersData } = await supabaseAdmin
      .from('beat_offers')
      .select('id, beat_title, beat_slug, full_name, email, amount, message, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    beatOffers = (offersData as BeatOffer[]) || [];

    const { data: earningsData } = await supabaseAdmin
      .from('producer_earnings')
      .select('id, gross_amount, platform_fee_amount, producer_amount, status, producer_notified_at, created_at, producers(stage_name, email), beats(title)')
      .order('created_at', { ascending: false })
      .limit(50);
    producerEarnings = (earningsData as unknown as ProducerEarning[]) || [];
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
    analyticsReleases = [
      ...releaseHistory.releases.map(release => ({
        title: release.title,
        slug: release.slug,
        cover: release.cover,
        artistSlug: null
      })),
      ...Object.entries(artistReleaseHistory.artists).flatMap(([artistSlug, releases]) =>
        releases.map(release => ({
          title: release.title,
          slug: release.slug,
          cover: release.cover,
          artistSlug
        }))
      )
    ];
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

  try {
    const supabaseAdmin = createSupabaseAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    artistAccessAccounts = data.users
      .filter(user => user.app_metadata?.lujo_role === 'artist')
      .map(user => ({
        id: user.id,
        email: user.email || 'Sin correo',
        artistSlug: typeof user.app_metadata?.lujo_artist_slug === 'string'
          ? user.app_metadata.lujo_artist_slug
          : '',
        status: isAccessStatus(user.app_metadata?.lujo_access)
          ? user.app_metadata.lujo_access
          : 'inactive',
        confirmed: Boolean(user.email_confirmed_at),
        unlinkedAt: typeof user.app_metadata?.lujo_unlinked_at === 'string'
          ? user.app_metadata.lujo_unlinked_at
          : ''
      }));
  } catch (error) {
    artistAccessError = error instanceof Error ? error.message : 'No pude cargar los accesos de artistas.';
  }

  const testAccessAccounts = artistAccessAccounts.filter(account => account.artistSlug === TEST_ARTIST_SLUG);
  const linkedArtistAccessAccounts = artistAccessAccounts.filter(account =>
    account.artistSlug && account.artistSlug !== TEST_ARTIST_SLUG
  );
  const configuredArtistCount = artistData.artists.filter(artist =>
    linkedArtistAccessAccounts.some(account => account.artistSlug === artist.slug)
  ).length;

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
                <div className="span-2">
                  <SocialOrderEditor />
                </div>
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
              <summary>Accesos de artistas ({configuredArtistCount}/{artistData.artists.length})</summary>
              <p className="muted">
                Cada artista tiene un solo cupo. Para cambiar un correo perdido, desvincula primero
                la cuenta anterior y después invita la nueva.
              </p>
              {artistAccessError ? <p className="auth-error">{artistAccessError}</p> : null}
              <div className="artist-access-roster">
                <details className="artist-access-profile artist-access-profile-test">
                  <summary className="artist-access-profile-summary">
                    <span className="artist-access-profile-avatar is-test">P</span>
                    <span className="artist-access-profile-name">
                      <strong>Cuenta de prueba</strong>
                      <small>Privada · no pertenece al roster</small>
                    </span>
                    <span className={`artist-access-badge ${testAccessAccounts.length ? `is-${testAccessAccounts[0].status}` : ''}`}>
                      {testAccessAccounts.length ? ACCESS_STATUS_LABELS[testAccessAccounts[0].status] : 'Sin configurar'}
                    </span>
                  </summary>
                  <div className="artist-access-profile-body">
                    <p className="muted">
                      Úsala siempre para probar el portal. Sus cambios nunca modifican una página pública.
                    </p>
                    {testAccessAccounts.length ? testAccessAccounts.map(account => (
                      <div className="artist-access-account" key={account.id}>
                        <div className="artist-access-copy">
                          <strong>{account.email}</strong>
                          <small>{account.confirmed ? 'Cuenta confirmada' : 'Invitación pendiente'}</small>
                        </div>
                        <ActionForm
                          action={updateArtistUserAccessAction}
                          className="artist-access-status-form"
                          savingMessage="Actualizando la cuenta de prueba..."
                          successMessage="Cuenta de prueba actualizada."
                        >
                          <input type="hidden" name="userId" value={account.id} />
                          <label>
                            Estado
                            <select name="accessStatus" defaultValue={account.status}>
                              <option value="active">Activo</option>
                              <option value="suspended">Pausado</option>
                              <option value="inactive">Inactivo</option>
                            </select>
                          </label>
                          <SubmitButton pendingText="Guardando...">Guardar</SubmitButton>
                        </ActionForm>
                        <details className="artist-access-emergency">
                          <summary>Desvincular cuenta de prueba</summary>
                          <ActionForm
                            action={unlinkArtistUserAction}
                            className="artist-access-unlink-form"
                            savingMessage="Desvinculando la cuenta de prueba..."
                            successMessage="Cuenta de prueba desvinculada."
                          >
                            <input type="hidden" name="userId" value={account.id} />
                            <label>
                              Escribe DESVINCULAR
                              <input name="confirmation" autoComplete="off" required />
                            </label>
                            <SubmitButton className="danger" pendingText="Desvinculando...">Desvincular</SubmitButton>
                          </ActionForm>
                        </details>
                      </div>
                    )) : (
                      <ActionForm
                        action={createTestArtistUserAction}
                        className="artist-access-invite"
                        savingMessage="Preparando la cuenta de prueba..."
                        successMessage="Cuenta de prueba preparada. Revisa el correo si era una cuenta nueva."
                        resetOnSuccess
                      >
                        <label>
                          Tu correo para pruebas
                          <input type="email" name="email" placeholder="tu-correo+prueba@gmail.com" required />
                        </label>
                        <SubmitButton className="primary" pendingText="Preparando...">Crear cuenta de prueba</SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </details>

                {artistData.artists.map(artist => {
                  const accounts = linkedArtistAccessAccounts.filter(account => account.artistSlug === artist.slug);
                  const summaryStatus = accounts.length > 1
                    ? `${accounts.length} correos · corregir`
                    : accounts.length === 1
                      ? ACCESS_STATUS_LABELS[accounts[0].status]
                      : 'Sin acceso';

                  return (
                    <details className="artist-access-profile" key={artist.slug}>
                      <summary className="artist-access-profile-summary">
                        {artist.photo ? (
                          <img className="artist-access-profile-avatar" src={`https://www.lujourban.com/${artist.photo}`} alt="" />
                        ) : (
                          <span className="artist-access-profile-avatar">{initials(artist.name)}</span>
                        )}
                        <span className="artist-access-profile-name">
                          <strong>{artist.cardName || artist.name}</strong>
                          <small>{accounts.length === 1 ? accounts[0].email : 'Un solo correo permitido'}</small>
                        </span>
                        <span className={`artist-access-badge ${accounts.length > 1 ? 'is-warning' : accounts[0] ? `is-${accounts[0].status}` : ''}`}>
                          {summaryStatus}
                        </span>
                      </summary>
                      <div className="artist-access-profile-body">
                        {accounts.length > 1 ? (
                          <p className="artist-access-warning">
                            Hay varios correos heredados en este perfil. Conserva el correcto y desvincula los demás.
                          </p>
                        ) : null}

                        {accounts.length ? accounts.map(account => (
                          <div className="artist-access-account" key={account.id}>
                            <div className="artist-access-copy">
                              <strong>{account.email}</strong>
                              <small>{account.confirmed ? 'Cuenta confirmada' : 'Invitación pendiente'}</small>
                              <span className={`artist-access-badge is-${account.status}`}>{ACCESS_STATUS_LABELS[account.status]}</span>
                            </div>
                            <ActionForm
                              action={updateArtistUserAccessAction}
                              className="artist-access-status-form"
                              savingMessage={`Actualizando el acceso de ${account.email}...`}
                              successMessage="Acceso actualizado."
                            >
                              <input type="hidden" name="userId" value={account.id} />
                              <label>
                                Estado
                                <select name="accessStatus" defaultValue={account.status}>
                                  <option value="active">Activo</option>
                                  <option value="suspended">Pausado</option>
                                  <option value="inactive">Inactivo</option>
                                </select>
                              </label>
                              <SubmitButton pendingText="Guardando...">Guardar</SubmitButton>
                            </ActionForm>
                            {account.status === 'inactive' && !testAccessAccounts.length ? (
                              <ActionForm
                                action={convertArtistUserToTestAction}
                                savingMessage="Moviendo esta cuenta al espacio de prueba..."
                                successMessage="La cuenta ahora es la cuenta de prueba privada."
                              >
                                <input type="hidden" name="userId" value={account.id} />
                                <SubmitButton pendingText="Moviendo...">Usar como prueba</SubmitButton>
                              </ActionForm>
                            ) : null}
                            <details className="artist-access-emergency">
                              <summary>Desvincular por cambio de correo</summary>
                              <p className="muted">
                                Bloquea este acceso y libera el perfil para vincular un correo nuevo.
                              </p>
                              <ActionForm
                                action={unlinkArtistUserAction}
                                className="artist-access-unlink-form"
                                savingMessage={`Desvinculando ${account.email}...`}
                                successMessage="Correo desvinculado. Ya puedes registrar el nuevo."
                              >
                                <input type="hidden" name="userId" value={account.id} />
                                <label>
                                  Escribe DESVINCULAR
                                  <input name="confirmation" autoComplete="off" required />
                                </label>
                                <SubmitButton className="danger" pendingText="Desvinculando...">Desvincular correo</SubmitButton>
                              </ActionForm>
                            </details>
                          </div>
                        )) : (
                          <ActionForm
                            action={inviteArtistUserAction}
                            className="artist-access-invite"
                            savingMessage={`Creando el acceso de ${artist.cardName || artist.name}...`}
                            successMessage="Acceso preparado. Revisa el correo si era una cuenta nueva."
                            resetOnSuccess
                          >
                            <input type="hidden" name="artistSlug" value={artist.slug} />
                            <label>
                              Correo del artista
                              <input type="email" name="email" placeholder="artista@correo.com" required />
                            </label>
                            <SubmitButton className="primary" pendingText="Enviando...">Vincular y enviar invitación</SubmitButton>
                          </ActionForm>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </details>

            <details className="subfolder">
              <summary>Artistas guardados</summary>
              <div className="artist-folders">
                {artistData.artists.map((artist, index) => (
                  <details className="admin-item-accordion artist-folder" key={artist.slug}>
                    <summary className="admin-item-summary">
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
                      <span className="admin-item-badge">Artista</span>
                    </summary>
                    <div className="artist-folder-body">
                      <p className="muted">{artist.tagline}</p>
                      {artist.release ? <p className="muted">Release activo: {artist.release.title}</p> : null}
                      <div className="actions artist-actions">
                        <a className="button artist-view-button" href={`https://www.lujourban.com/artistas/${artist.slug}/`} target="_blank" rel="noreferrer">Ver perfil</a>
                        <details className="inline-details artist-edit-details">
                          <summary className="button artist-edit-toggle">
                            <span className="artist-edit-toggle-open">Editar perfil</span>
                            <span className="artist-edit-toggle-close">Cerrar editor</span>
                          </summary>
                          <ActionForm
                            action={saveArtistAction}
                            className="mini-form artist-edit-form"
                            savingMessage={`Guardando cambios de ${artist.cardName || artist.name}...`}
                            successMessage="Artista actualizado correctamente."
                          >
                            <input name="originalSlug" type="hidden" value={artist.slug} />
                            <div className="artist-edit-heading">
                              <span>Editor del perfil</span>
                              <strong>{artist.cardName || artist.name}</strong>
                              <small>Actualiza el contenido. La plantilla y el diseño permanecen protegidos.</small>
                            </div>
                            <fieldset className="artist-edit-section">
                              <legend>Identidad</legend>
                              <div className="artist-edit-grid">
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
                              </div>
                            </fieldset>
                            <fieldset className="artist-edit-section">
                              <legend>Imagen del artista</legend>
                              <div className="artist-edit-grid">
                            <label>
                              Subir foto nueva
                              <input name="photoFile" type="file" accept="image/*" />
                              <small>Usa una foto cuadrada (ej. 1000x1000px) para que se vea perfecta en todas las secciones.</small>
                            </label>
                            <label>
                              Foto (si no subes una nueva)
                              <input name="photo" defaultValue={artist.photo || ''} />
                            </label>
                              </div>
                            </fieldset>
                            <fieldset className="artist-edit-section">
                              <legend>Redes y plataformas</legend>
                              <div className="artist-edit-grid">
                            {['spotify', 'tiktok', 'instagram', 'youtube', 'facebook', 'whatsapp'].map(key => (
                              <label key={key}>
                                {key}
                                <input name={key} defaultValue={artist.links?.[key] || ''} />
                              </label>
                            ))}
                              </div>
                              <SocialOrderEditor initialOrder={artist.socialOrder} links={artist.links} />
                            </fieldset>
                            <fieldset className="artist-edit-section">
                              <legend>Integraciones y contacto</legend>
                              <div className="artist-edit-grid">
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
                              </div>
                            </fieldset>
                            <div className="artist-edit-footer">
                              <a className="button artist-edit-preview" href={`https://www.lujourban.com/artistas/${artist.slug}/`} target="_blank" rel="noreferrer">Vista pública</a>
                              <SubmitButton className="primary" pendingText="Guardando...">Guardar cambios</SubmitButton>
                            </div>
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
                  Portada ya subida (opcional)
                  <input name="cover" placeholder="assets/artista-cancion-cover.jpg" />
                </label>
                <label>
                  Subir portada manual
                  <input name="coverFile" type="file" accept="image/*" />
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

            <details className="subfolder">
              <summary>Artistas con lanzamientos ({artistData.artists.length})</summary>
              <div className="cards">
                {artistData.artists.map(artist => {
                  const releases = artistReleaseHistory.artists[artist.slug] || [];
                  return (
                    <details className="admin-item-accordion" key={`${artist.slug}-releases`}>
                      <summary className="admin-item-summary">
                        {artist.photo ? (
                          <img className="thumb" src={`https://www.lujourban.com/${artist.photo}`} alt="" />
                        ) : (
                          <div className="thumb placeholder">{initials(artist.name)}</div>
                        )}
                        <span className="admin-item-copy">
                          <strong>{artist.cardName || artist.name}</strong>
                          <small>{releases.length ? `${releases.length} lanzamiento(s) guardado(s)` : 'Sin historial de lanzamientos'}</small>
                        </span>
                        <span className="admin-item-badge">{artist.slug}</span>
                      </summary>
                      <div className="admin-item-panel">
                        {releases.length ? (
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
                        ) : (
                          <p className="muted">Publica un lanzamiento para activar el historial de este artista.</p>
                        )}
                      </div>
                    </details>
                  );
                })}
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

            <details className="subfolder">
              <summary>Lanzamientos fijados ({casaCatalog.picks.length})</summary>
              {casaCatalog.picks.length === 0 ? (
                <p className="muted">Todavia no hay lanzamientos fijados manualmente.</p>
              ) : (
                <ol className="cards catalog-picks">
                  {casaCatalog.picks.map((pick, index) => {
                    const label = resolveCasaCatalogPickLabel(pick, artistData, releaseHistory, artistReleaseHistory);
                    return (
                      <li key={`${pick.source}-${pick.artistSlug || 'zaetta'}-${pick.releaseSlug}`}>
                        <details className="admin-item-accordion">
                          <summary className="admin-item-summary">
                            {label.cover ? (
                              <img className="thumb" src={label.cover} alt="" />
                            ) : (
                              <div className="thumb placeholder">{initials(label.title)}</div>
                            )}
                            <span className="admin-item-copy">
                              <strong>{`${index + 1}. ${label.title}`}</strong>
                              <small>{label.sourceName}</small>
                            </span>
                            <span className="admin-item-badge">Casa</span>
                          </summary>
                          <div className="admin-item-panel">
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
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ol>
              )}
            </details>

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
            <details className="subfolder">
              <summary>Configuración de vitrina</summary>
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
            </details>

            <details className="subfolder">
              <summary>Productores ({producers.length})</summary>
              <ActionForm
                action={createProducerAction}
                className="grid"
                savingMessage="Creando productor..."
                successMessage="Productor creado."
                resetOnSuccess
              >
                <label>
                  Nombre artistico
                  <input name="stage_name" required placeholder="Zaetta" />
                </label>
                <label>
                  Correo de notificacion
                  <input name="email" type="email" required placeholder="productor@email.com" />
                </label>
                <label>
                  Comisión LUJO URBAN (%)
                  <input name="platform_commission_percent" type="number" min="0" max="100" step="0.01" defaultValue="30" />
                  <small className="muted">El resto queda como ganancia del productor.</small>
                </label>
                <label>
                  Notas internas
                  <input name="notes" placeholder="Datos de pago, acuerdo, contacto..." />
                </label>
                <SubmitButton className="primary span-2" pendingText="Guardando...">
                  Crear productor
                </SubmitButton>
              </ActionForm>

              {producers.length > 0 && (
                <ol className="cards">
                  {producers.map((producer) => (
                    <li className="card" key={producer.id}>
                      <div>
                        <h3>{producer.stage_name}</h3>
                        <p className="muted">
                          {producer.email} · LUJO URBAN {producer.platform_commission_percent}%
                          {' · '}
                          {producer.status === 'active' ? 'Activo' : 'Inactivo'}
                        </p>
                        {producer.notes && <p className="muted">{producer.notes}</p>}
                      </div>
                      <div className="actions">
                        <ActionForm
                          action={toggleProducerStatusAction}
                          savingMessage="Actualizando productor..."
                          successMessage="Productor actualizado."
                        >
                          <input name="id" type="hidden" value={producer.id} />
                          <input name="status" type="hidden" value={producer.status} />
                          <SubmitButton pendingText="...">
                            {producer.status === 'active' ? 'Desactivar' : 'Activar'}
                          </SubmitButton>
                        </ActionForm>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </details>

            <details className="subfolder">
              <summary>Beats publicados ({beats.length})</summary>
              {beats.length === 0 ? (
                <p className="muted">Todavía no hay beats publicados.</p>
              ) : (
                <ol className="cards catalog-picks">
                  {beats.map((beat) => (
                    <li key={beat.id}>
                      <details className="beat-admin-card">
                        <summary className="beat-admin-summary">
                          {beat.cover_url ? (
                            <img className="thumb" src={beatCoverUrl(beat.cover_url)} alt="" />
                          ) : (
                            <div className="thumb placeholder">{initials(beat.title)}</div>
                          )}
                          <span className="beat-admin-copy">
                            <strong>{beat.title}</strong>
                            <small>
                              {[beat.genre, beat.bpm ? `${beat.bpm} BPM` : null, beat.key]
                                .filter(Boolean)
                                .join(' · ') || 'Sin metadata'}
                            </small>
                            <small>
                              Productor: {producers.find((producer) => producer.id === beat.producer_id)?.stage_name ?? beat.producer ?? 'Sin asignar'}
                            </small>
                          </span>
                          <span className="beat-admin-status">
                            {beat.status === 'available' ? 'Disponible' : 'Vendida'}
                          </span>
                        </summary>

                        <div className="beat-admin-panel">
                          <ActionForm
                            action={updateBeatMetadataAction}
                            className="grid beat-edit-form"
                            savingMessage="Editando beat..."
                            successMessage="Beat actualizado."
                          >
                            <input name="id" type="hidden" value={beat.id} />
                            <label className="span-2">
                              <span className="field-label">Título <em>obligatorio</em></span>
                              <input name="title" required defaultValue={beat.title} />
                            </label>
                            <label>
                              <span className="field-label">BPM <em>opcional</em></span>
                              <input name="bpm" type="number" defaultValue={beat.bpm ?? ''} />
                            </label>
                            <label>
                              <span className="field-label">Tonalidad <em>opcional</em></span>
                              <input name="key" defaultValue={beat.key ?? ''} />
                            </label>
                            <label>
                              <span className="field-label">Género <em>opcional</em></span>
                              <input name="genre" defaultValue={beat.genre ?? ''} />
                            </label>
                            <label>
                              <span className="field-label">Productor <em>opcional</em></span>
                              <select name="producer_id" defaultValue={beat.producer_id ?? ''}>
                                <option value="">Sin productor</option>
                                {producers.map((producer) => (
                                  <option key={producer.id} value={producer.id}>
                                    {producer.stage_name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="span-2">
                              <span className="field-label">Tags <em>opcional</em></span>
                              <input name="tags" defaultValue={(beat.tags ?? []).join(', ')} />
                            </label>
                            <label>
                              <span className="field-label">Básica <em>COP</em></span>
                              <input name="price_basic" type="number" required defaultValue={beat.price_basic} />
                            </label>
                            <label>
                              <span className="field-label">Premium <em>COP</em></span>
                              <input name="price_premium" type="number" required defaultValue={beat.price_premium} />
                            </label>
                            <label>
                              <span className="field-label">Ilimitada <em>COP</em></span>
                              <input name="price_exclusive" type="number" required defaultValue={beat.price_exclusive} />
                            </label>
                            <SubmitButton className="primary span-2" pendingText="Guardando...">
                              Guardar cambios
                            </SubmitButton>
                          </ActionForm>

                          <BeatFilesUploadForm
                            beatId={beat.id}
                            paths={{
                              basic: beat.file_basic_path,
                              premium: beat.file_premium_path,
                              exclusive: beat.file_exclusive_path
                            }}
                          />

                          <div className="beat-admin-actions">
                            <p className="muted">
                              Básica {formatCOP(beat.price_basic)} · Premium {formatCOP(beat.price_premium)} · Ilimitada {formatCOP(beat.price_exclusive)}
                            </p>
                            <div className="actions">
                              <ActionForm
                                action={toggleBeatStatusAction}
                                savingMessage="Actualizando estado..."
                                successMessage="Estado del beat actualizado."
                              >
                                <input name="id" type="hidden" value={beat.id} />
                                <input name="status" type="hidden" value={beat.status} />
                                <SubmitButton pendingText="...">
                                  {beat.status === 'available' ? 'Marcar vendido (exclusiva negociada)' : 'Marcar disponible'}
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
                          </div>
                        </div>
                      </details>
                    </li>
                  ))}
                </ol>
              )}
            </details>

            <details className="subfolder">
              <summary>Agregar beat nuevo</summary>
              <BeatUploadForm producers={producers} />
            </details>

            <details className="subfolder">
              <summary>Ganancias de productores ({producerEarnings.length})</summary>
              {producerEarnings.length === 0 ? (
                <p className="muted">Todavía no hay ganancias registradas para productores.</p>
              ) : (
                <ol className="cards">
                  {producerEarnings.map((earning) => (
                    <li className="card" key={earning.id}>
                      <div>
                        <h3>
                          {earning.producers?.stage_name ?? 'Productor eliminado'} · {formatCOP(earning.producer_amount)}
                        </h3>
                        <p className="muted">
                          {earning.beats?.title ?? 'Beat eliminado'} · Venta {formatCOP(earning.gross_amount)} · LUJO URBAN {formatCOP(earning.platform_fee_amount)}
                        </p>
                        <p className="muted">
                          {earning.status === 'pending' ? 'Pendiente de pago' : earning.status === 'paid' ? 'Pagada' : 'Cancelada'}
                          {' · '}
                          {earning.producer_notified_at ? 'Productor notificado' : 'Notificacion pendiente'}
                          {' · '}
                          {new Date(earning.created_at).toLocaleString('es-CO', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </details>

            <details className="subfolder">
              <summary>Ofertas exclusivas ({beatOffers.length})</summary>
              {beatOffers.length === 0 ? (
                <p className="muted">Todavía no hay ofertas exclusivas registradas.</p>
              ) : (
                <ol className="cards">
                  {beatOffers.map((offer) => (
                    <li className="card" key={offer.id}>
                      <div>
                        <h3>{offer.beat_title} — {offer.amount}</h3>
                        <p className="muted">
                          {offer.full_name} · {offer.email} · {OFFER_STATUS_LABELS[offer.status]}
                        </p>
                        <p className="muted">
                          {new Date(offer.created_at).toLocaleString('es-CO', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </p>
                        {offer.message && <p className="muted">{offer.message}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </details>

            <details className="subfolder">
              <summary>Órdenes y ventas ({beatOrders.length})</summary>
              {beatOrders.length === 0 ? (
                <p className="muted">Todavía no hay órdenes registradas.</p>
              ) : (
                <ol className="cards">
                  {beatOrders.map((order) => (
                    <li className="card" key={order.id}>
                      <div>
                        <h3>
                          {formatCOP(order.total_amount)} — {ORDER_STATUS_LABELS[order.status]}
                        </h3>
                        <p className="muted">
                          {order.buyer_email} ·{' '}
                          {new Date(order.created_at).toLocaleString('es-CO', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </p>
                        <p className="muted">
                          {order.order_items
                            .map((item) => `${item.beats?.title ?? 'Beat eliminado'} (${LICENSE_LABELS[item.license_type].name})`)
                            .join(' · ')}
                        </p>
                      </div>
                      {order.status === 'approved' && (
                        <div className="actions">
                          <ActionForm
                            action={resendOrderEmailAction}
                            savingMessage="Reenviando correo de descarga..."
                            successMessage="Correo de descarga reenviado."
                          >
                            <input name="id" type="hidden" value={order.id} />
                            <SubmitButton pendingText="Enviando...">Reenviar correo de descarga</SubmitButton>
                          </ActionForm>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
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
            <AnalyticsDashboard summary={analyticsSummary} releases={analyticsReleases} />
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
