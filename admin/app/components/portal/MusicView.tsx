import type { ArtistRelease } from '@/lib/artist-renderer';
import { formatNumber, linkHost } from '@/lib/portal-format';
import {
  deleteOwnReleaseAction,
  promoteOwnReleaseAction,
  saveOwnArtistPortalAction,
  updateOwnReleaseAction
} from '../../artist-portal-actions';
import { ActionForm } from '../ActionForm';
import { PortalImageField } from '../PortalImageField';
import { SubmitButton } from '../SubmitButton';

export type MusicSong = ArtistRelease & {
  slug: string;
  coverUrl: string;
  listens: number;
  // Titulo de otra cancion que tiene el mismo enlace (vacio = ninguna).
  sameLinkAs: string;
};

type MusicViewProps = {
  current: MusicSong | null;
  // Del mas nuevo al mas viejo, igual que en "Más música" de la pagina publica.
  past: MusicSong[];
  maxTitleLength: number;
  isTestAccount: boolean;
};

const Cover = ({ song, size }: { song: MusicSong; size: number }) => song.coverUrl
  ? <img className="pt-song-cover" src={song.coverUrl} alt="" width={size} height={size} loading="lazy" />
  : <span className="pt-song-cover pt-cover-empty" aria-hidden="true">Sin portada</span>;

const SongMeta = ({ song }: { song: MusicSong }) => (
  <>
    <small>
      {linkHost(song.link) || 'Sin enlace'}
      {song.listens > 0 ? ` · ${formatNumber(song.listens)} ${song.listens === 1 ? 'escucha' : 'escuchas'} este mes` : ''}
    </small>
    {song.sameLinkAs ? <small className="pt-warn">Tiene el mismo enlace que «{song.sameLinkAs}»</small> : null}
  </>
);

const EditForm = ({ song, maxTitleLength }: { song: MusicSong; maxTitleLength: number }) => (
  <ActionForm
    action={updateOwnReleaseAction}
    className="pt-form"
    savingMessage={`Guardando «${song.title}» y publicando tu página...`}
    successMessage="Canción actualizada. Tu página se está publicando."
  >
    <input type="hidden" name="releaseSlug" value={song.slug} />
    <label>
      Nombre de la canción
      <input name="title" defaultValue={song.title} maxLength={maxTitleLength} required autoComplete="off" />
    </label>
    <label>
      Enlace para escuchar
      <input type="url" name="link" defaultValue={song.link} placeholder="https://..." required />
    </label>
    <PortalImageField
      name="cover"
      label="Cambiar portada"
      emptyLabel="Sin portada"
      currentUrl={song.coverUrl}
      hint="Cuadrada, JPG, PNG o WebP. Si no eliges una, se queda la que tiene."
    />
    <SubmitButton className="primary" pendingText="Guardando...">Guardar canción</SubmitButton>
  </ActionForm>
);

export function MusicView({ current, past, maxTitleLength, isTestAccount }: MusicViewProps) {
  return (
    <>
      <h1 className="pt-title">Mi música</h1>

      <section className="pt-block">
        <h2 className="pt-h2">Canción principal</h2>
        {current ? (
          <article className="pt-song pt-song-main">
            <div className="pt-song-head">
              <Cover song={current} size={88} />
              <div className="pt-song-text">
                <strong>{current.title}</strong>
                <SongMeta song={current} />
              </div>
            </div>
            {isTestAccount ? null : (
              <details className="pt-fold">
                <summary>Editar canción</summary>
                <div className="pt-fold-body">
                  <EditForm song={current} maxTitleLength={maxTitleLength} />
                </div>
              </details>
            )}
          </article>
        ) : (
          <p className="pt-empty">Todavía no tienes una canción en tu página. Publica la primera aquí abajo.</p>
        )}

        <details className="pt-fold pt-fold-new" open={!current}>
          <summary>{current ? 'Publicar música nueva' : 'Publicar mi primera canción'}</summary>
          <div className="pt-fold-body">
            {current ? (
              <p className="pt-help">
                La nueva pasa a ser tu canción principal y «{current.title}» baja a «Más música».
              </p>
            ) : null}
            <ActionForm
              action={saveOwnArtistPortalAction}
              className="pt-form"
              savingMessage={isTestAccount ? 'Guardando en la cuenta de prueba...' : 'Publicando tu canción...'}
              successMessage={isTestAccount ? 'Prueba guardada. Nada se publicó.' : 'Canción publicada. Tu página se está actualizando.'}
              resetOnSuccess
            >
              <label>
                Nombre de la canción
                <input name="newReleaseTitle" maxLength={maxTitleLength} placeholder="Como aparece en plataformas" required autoComplete="off" />
              </label>
              <label>
                Enlace para escuchar
                <input type="url" name="newReleaseLink" placeholder="https://..." required />
              </label>
              <PortalImageField
                name="newReleaseCover"
                label="Portada"
                emptyLabel="Portada"
                hint={isTestAccount
                  ? 'En la cuenta de prueba las imágenes no se guardan.'
                  : 'Cuadrada, JPG, PNG o WebP. Si no subes una, intentamos tomarla del enlace.'}
              />
              <SubmitButton className="primary" pendingText="Publicando...">Publicar canción</SubmitButton>
            </ActionForm>
          </div>
        </details>
      </section>

      <section className="pt-block">
        <h2 className="pt-h2">Más música</h2>
        {past.length ? (
          <>
            <p className="pt-help">Así salen en tu página, debajo de la canción principal. La más reciente va primero.</p>
            <ul className="pt-songs">
              {past.map(song => (
                <li key={song.slug}>
                  <article className="pt-song">
                    <div className="pt-song-head">
                      <Cover song={song} size={56} />
                      <div className="pt-song-text">
                        <strong>{song.title}</strong>
                        <SongMeta song={song} />
                      </div>
                    </div>
                    <details className="pt-fold">
                      <summary>Editar canción</summary>
                      <div className="pt-fold-body">
                        <EditForm song={song} maxTitleLength={maxTitleLength} />

                        <div className="pt-song-more">
                          <ActionForm
                            action={promoteOwnReleaseAction}
                            className="pt-inline-form"
                            savingMessage={`Poniendo «${song.title}» de principal...`}
                            successMessage={`«${song.title}» ahora es tu canción principal.`}
                          >
                            <input type="hidden" name="releaseSlug" value={song.slug} />
                            <p>Volver a ponerla arriba, como tu canción principal.</p>
                            <SubmitButton pendingText="Cambiando...">Poner de principal</SubmitButton>
                          </ActionForm>

                          <ActionForm
                            action={deleteOwnReleaseAction}
                            className="pt-inline-form pt-danger"
                            savingMessage={`Borrando «${song.title}»...`}
                            successMessage="Canción borrada de tu página."
                          >
                            <input type="hidden" name="releaseSlug" value={song.slug} />
                            <label className="pt-check">
                              <input type="checkbox" name="confirm" value="si" required />
                              <span>Quiero borrar «{song.title}» de mi página. No se puede deshacer.</span>
                            </label>
                            <SubmitButton pendingText="Borrando...">Borrar canción</SubmitButton>
                          </ActionForm>
                        </div>
                      </div>
                    </details>
                  </article>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="pt-empty">
            Aquí van a quedar tus canciones anteriores. Cuando publiques música nueva, la que tienes hoy baja a esta lista y sigue visible en tu página.
          </p>
        )}
      </section>
    </>
  );
}
