import { redirect } from 'next/navigation';
import { getCurrentAccess } from '@/lib/auth';
import { artistService } from '@/lib/artists';
import { emptyArtistStats, getArtistStats } from '@/lib/artist-stats';
import { SOCIAL_KEYS, SOCIAL_LABELS, resolveHeroButtons } from '@/lib/socials';
import { readTestArtist, TEST_ARTIST_SLUG } from '@/lib/test-artist';
import { ActionForm } from '../components/ActionForm';
import { MAX_RELEASE_TITLE_LENGTH } from '@/lib/artists';
import { AutoLogoutTimer } from '../components/AutoLogoutTimer';
import { PortalActivityTracker } from '../components/PortalActivityTracker';
import { PortalImageField } from '../components/PortalImageField';
import { PortalStats } from '../components/PortalStats';
import { SocialOrderEditor } from '../components/SocialOrderEditor';
import { SubmitButton } from '../components/SubmitButton';
import { saveOwnArtistPortalAction } from '../artist-portal-actions';

const statusCopy = {
  suspended: {
    eyebrow: 'Acceso pausado',
    title: 'Tu perfil esta protegido',
    message: 'No puedes editar mientras el acceso este pausado. Tu pagina publica no cambia. Contacta a Lujo Urban para reactivarlo.'
  },
  inactive: {
    eyebrow: 'Acceso inactivo',
    title: 'Tu acceso aun no esta activo',
    message: 'Lujo Urban debe activar esta cuenta antes de que puedas editar tu perfil.'
  }
} as const;

export default async function ArtistPortalPage() {
  const access = await getCurrentAccess();
  if (!access) redirect('/login');
  if (access.role === 'admin') redirect('/');
  if (access.role !== 'artist' || !access.artistSlug) redirect('/login?error=access');

  const isTestAccount = access.artistSlug === TEST_ARTIST_SLUG;
  const artist = isTestAccount
    ? readTestArtist(access.user.app_metadata?.lujo_test_profile)
    : (await artistService.findArtistBySlug(access.artistSlug))?.artist;

  if (!artist) {
    return (
      <main className="artist-portal-shell">
        <AutoLogoutTimer />
        <PortalActivityTracker />
        <header className="artist-portal-topbar">
          <div>
            <p className="eyebrow">Mi espacio</p>
            <h1>Lujo Urban</h1>
          </div>
          <form action="/api/logout" method="post"><button className="logout-button">Salir</button></form>
        </header>
        <section className="artist-portal-card artist-portal-restricted">
          <span className="artist-portal-lock" aria-hidden="true">!</span>
          <h2>Perfil no encontrado</h2>
          <p>Tu usuario existe, pero el perfil vinculado ya no esta en el roster. Contacta a Lujo Urban.</p>
        </section>
      </main>
    );
  }

  if (access.status !== 'active') {
    const copy = statusCopy[access.status];
    return (
      <main className="artist-portal-shell">
        <AutoLogoutTimer />
        <PortalActivityTracker />
        <header className="artist-portal-topbar">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>Lujo Urban</h1>
          </div>
          <form action="/api/logout" method="post"><button className="logout-button">Salir</button></form>
        </header>
        <section className="artist-portal-card artist-portal-restricted">
          <span className="artist-portal-lock" aria-hidden="true">◇</span>
          <h2>{copy.title}</h2>
          <p>{copy.message}</p>
          {isTestAccount ? (
            <span className="artist-portal-private-label">Prueba privada</span>
          ) : (
            <a className="button" href={`https://www.lujourban.com/artistas/${artist.slug}/`} target="_blank" rel="noreferrer">
              Ver mi página pública
            </a>
          )}
        </section>
      </main>
    );
  }

  const resolvedHeroButtons = resolveHeroButtons(artist.links, artist.heroButtons);
  // El slug sale de la sesion: un artista solo puede ver sus propios numeros.
  const stats = isTestAccount ? emptyArtistStats() : await getArtistStats(artist.slug);
  const siteUrl = (path?: string) => path ? `https://www.lujourban.com/${path}` : '';
  // Cuando cambia el lanzamiento o la foto, estos bloques se montan de nuevo
  // y los campos de "musica nueva" y de imagen vuelven a quedar vacios.
  const mediaKey = `${artist.release?.slug || ''}|${artist.release?.title || ''}|${artist.photo || ''}`;

  return (
    <main className="artist-portal-shell">
      <AutoLogoutTimer />
      <PortalActivityTracker />
      <header className="artist-portal-topbar">
        <div>
          <p className="eyebrow">Portal del artista</p>
          <h1>Lujo Urban</h1>
        </div>
        <form action="/api/logout" method="post"><button className="logout-button">Salir</button></form>
      </header>

      {isTestAccount ? (
        <section className="artist-portal-test-banner">
          <strong>Modo prueba privado</strong>
          <span>Puedes probar todos los controles. Nada de aquí modifica ni publica un artista real.</span>
        </section>
      ) : null}

      <section className="artist-portal-profile">
        {artist.photo ? (
          <img src={`https://www.lujourban.com/${artist.photo}`} alt="" />
        ) : (
          <span className="artist-portal-avatar">{artist.name.slice(0, 2)}</span>
        )}
        <div>
          <span className="artist-portal-status"><i /> Cuenta activa</span>
          <h2>{artist.cardName || artist.name}</h2>
          <p>{artist.tagline}</p>
        </div>
        {isTestAccount ? (
          <span className="artist-portal-private-label">Solo prueba</span>
        ) : (
          <a className="button" href={`https://www.lujourban.com/artistas/${artist.slug}/`} target="_blank" rel="noreferrer">
            Ver perfil
          </a>
        )}
      </section>

      <PortalStats stats={stats} isTestAccount={isTestAccount} />

      <ActionForm
        action={saveOwnArtistPortalAction}
        className="artist-portal-form"
        savingMessage={isTestAccount
          ? 'Guardando los cambios de la prueba privada...'
          : 'Actualizando tu perfil y publicándolo...'}
        successMessage={isTestAccount
          ? 'Prueba guardada. Ningún artista real fue modificado.'
          : 'Tu perfil quedó actualizado y se está publicando.'}
      >
        <section className="artist-portal-card">
          <div className="artist-portal-card-heading">
            <span>01</span>
            <div>
              <p className="eyebrow">Tus enlaces</p>
              <h2>Redes y plataformas</h2>
            </div>
          </div>
          <p className="artist-portal-help">
            Puedes cambiar los destinos. Si dejas una red vacia, esa tarjeta no aparece en tu pagina.
          </p>
          <div className="artist-portal-fields">
            {SOCIAL_KEYS.map(key => (
              <label key={key}>
                {SOCIAL_LABELS[key]}
                <input
                  type="url"
                  name={key}
                  defaultValue={artist.links?.[key] || ''}
                  placeholder="https://..."
                />
              </label>
            ))}
          </div>
        </section>

        <section className="artist-portal-card">
          <div className="artist-portal-card-heading">
            <span>02</span>
            <div>
              <p className="eyebrow">Zona destacada</p>
              <h2>Botones superiores</h2>
            </div>
          </div>
          <p className="artist-portal-help">
            Escoge las dos plataformas que quieres destacar arriba. El primer botón conserva el fondo verde y el segundo el estilo oscuro de Lujo Urban.
          </p>
          <div className="artist-portal-fields artist-portal-hero-fields">
            <label>
              Botón verde principal
              <select name="heroPrimary" defaultValue={resolvedHeroButtons.primary || ''}>
                <option value="">Seleccionar red</option>
                {SOCIAL_KEYS.map(key => (
                  <option key={key} value={key}>
                    {SOCIAL_LABELS[key]}{artist.links?.[key] ? '' : ' · agrega su enlace arriba'}
                  </option>
                ))}
              </select>
              <small>Spotify conserva el texto “Escucha ahora”; las demás muestran el nombre de la red.</small>
            </label>
            <label>
              Botón oscuro secundario
              <select name="heroSecondary" defaultValue={resolvedHeroButtons.secondary || ''}>
                <option value="">Seleccionar red</option>
                {SOCIAL_KEYS.map(key => (
                  <option key={key} value={key}>
                    {SOCIAL_LABELS[key]}{artist.links?.[key] ? '' : ' · agrega su enlace arriba'}
                  </option>
                ))}
              </select>
              <small>Debe ser una red diferente a la elegida en el botón principal.</small>
            </label>
          </div>
        </section>

        <section className="artist-portal-card">
          <div className="artist-portal-card-heading">
            <span>03</span>
            <div>
              <p className="eyebrow">Orden visual</p>
              <h2>Organiza tus redes</h2>
            </div>
          </div>
          <SocialOrderEditor initialOrder={artist.socialOrder} links={artist.links} />
        </section>

        <section className="artist-portal-card" key={`release-${mediaKey}`}>
          <div className="artist-portal-card-heading">
            <span>04</span>
            <div>
              <p className="eyebrow">Musica actual</p>
              <h2>Tu lanzamiento</h2>
            </div>
          </div>
          {artist.release ? (
            <>
              <div className="portal-release-current">
                <span className="portal-image-preview">
                  {artist.release.cover
                    ? <img src={siteUrl(artist.release.cover)} alt="" />
                    : <small>Sin portada</small>}
                </span>
                <div>
                  <span className="artist-portal-status"><i /> En tu página</span>
                  <strong>{artist.release.title}</strong>
                </div>
              </div>
              <label>
                Enlace para escuchar
                <input
                  type="url"
                  name="releaseLink"
                  defaultValue={artist.release.link}
                  placeholder="https://..."
                  required
                />
                <small>Adonde lleva “Escuchar ahora” en la tarjeta de «{artist.release.title}».</small>
              </label>
            </>
          ) : (
            <p className="artist-portal-help">
              Todavía no tienes un lanzamiento en tu página. Publica el primero aquí abajo.
            </p>
          )}

          <div className="portal-release-new">
            <h3>{artist.release ? '¿Sacaste música nueva?' : 'Publica tu primer lanzamiento'}</h3>
            <p className="artist-portal-help">
              {artist.release
                ? `Llena estos campos solo si quieres cambiar la canción de tu página. La nueva reemplaza a «${artist.release.title}» en la tarjeta de último lanzamiento.`
                : 'Escribe el nombre de la canción y el enlace donde se escucha.'}
            </p>
            <div className="artist-portal-fields">
              <label>
                Nombre de la canción
                <input
                  name="newReleaseTitle"
                  maxLength={MAX_RELEASE_TITLE_LENGTH}
                  placeholder="Como aparece en plataformas"
                  autoComplete="off"
                />
              </label>
              <label>
                Enlace para escuchar
                <input type="url" name="newReleaseLink" placeholder="https://..." />
              </label>
            </div>
            <PortalImageField
              name="newReleaseCover"
              label="Portada"
              emptyLabel="Portada"
              hint={isTestAccount
                ? 'En la prueba privada las imágenes no se guardan.'
                : 'Cuadrada, JPG, PNG o WebP. Si no subes una, intentamos tomarla del enlace.'}
            />
          </div>
        </section>

        <section className="artist-portal-card" key={`photo-${mediaKey}`}>
          <div className="artist-portal-card-heading">
            <span>05</span>
            <div>
              <p className="eyebrow">Tu imagen</p>
              <h2>Foto de perfil</h2>
            </div>
          </div>
          <PortalImageField
            name="photoFile"
            label="Cambiar foto"
            emptyLabel="Sin foto"
            currentUrl={siteUrl(artist.photo)}
            hint={isTestAccount
              ? 'En la prueba privada las imágenes no se guardan.'
              : 'Cuadrada y con buena luz: es la que sale arriba en tu página y en el directorio.'}
          />
        </section>

        <div className="artist-portal-savebar">
          <span>
            <strong>Diseño protegido</strong>
            <small>Tú pones la música y la foto. Colores, tipografías y estructura siguen siendo Lujo Urban.</small>
          </span>
          <SubmitButton className="primary" pendingText={isTestAccount ? 'Guardando prueba...' : 'Publicando...'}>
            {isTestAccount ? 'Guardar prueba privada' : 'Guardar y publicar'}
          </SubmitButton>
        </div>
      </ActionForm>
    </main>
  );
}
