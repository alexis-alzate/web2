import { redirect } from 'next/navigation';
import { getCurrentAccess } from '@/lib/auth';
import { readJson } from '@/lib/github';
import type { ArtistData } from '@/lib/artist-renderer';
import { SOCIAL_KEYS, SOCIAL_LABELS, resolveHeroButtons } from '@/lib/socials';
import { readTestArtist, TEST_ARTIST_SLUG } from '@/lib/test-artist';
import { ActionForm } from '../components/ActionForm';
import { AutoLogoutTimer } from '../components/AutoLogoutTimer';
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
    : (await readJson<ArtistData>('artist-data.json', { artists: [] }))
      .artists.find(item => item.slug === access.artistSlug);

  if (!artist) {
    return (
      <main className="artist-portal-shell">
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

  return (
    <main className="artist-portal-shell">
      <AutoLogoutTimer />
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

      <ActionForm
        action={saveOwnArtistPortalAction}
        className="artist-portal-form"
        savingMessage={isTestAccount
          ? 'Guardando los cambios de la prueba privada...'
          : 'Actualizando tus enlaces y publicando tu perfil...'}
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

        <section className="artist-portal-card">
          <div className="artist-portal-card-heading">
            <span>04</span>
            <div>
              <p className="eyebrow">Musica actual</p>
              <h2>Enlace del lanzamiento</h2>
            </div>
          </div>
          {artist.release ? (
            <label>
              {artist.release.title}
              <input
                type="url"
                name="releaseLink"
                defaultValue={artist.release.link}
                placeholder="https://..."
                required
              />
              <small>Cambia adonde lleva “Escuchar ahora” dentro de la tarjeta de tu lanzamiento.</small>
            </label>
          ) : (
            <p className="artist-portal-help">
              Aun no tienes un lanzamiento activo. Lujo Urban debe crear el primero desde el panel principal.
            </p>
          )}
        </section>

        <div className="artist-portal-savebar">
          <span>
            <strong>Diseño protegido</strong>
            <small>Colores, tipografias y estructura siguen siendo Lujo Urban.</small>
          </span>
          <SubmitButton className="primary" pendingText={isTestAccount ? 'Guardando prueba...' : 'Publicando...'}>
            {isTestAccount ? 'Guardar prueba privada' : 'Guardar y publicar'}
          </SubmitButton>
        </div>
      </ActionForm>
    </main>
  );
}
