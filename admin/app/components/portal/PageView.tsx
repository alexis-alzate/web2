import type { Artist } from '@/lib/artist-renderer';
import { SOCIAL_KEYS, SOCIAL_LABELS, resolveHeroButtons } from '@/lib/socials';
import { saveOwnArtistPortalAction } from '../../artist-portal-actions';
import { ActionForm } from '../ActionForm';
import { PortalImageField } from '../PortalImageField';
import { SocialOrderEditor } from '../SocialOrderEditor';
import { SubmitButton } from '../SubmitButton';

type PageViewProps = {
  artist: Artist;
  photoUrl: string;
  isTestAccount: boolean;
};

export function PageView({ artist, photoUrl, isTestAccount }: PageViewProps) {
  const hero = resolveHeroButtons(artist.links, artist.heroButtons);
  const saving = isTestAccount ? 'Guardando en la cuenta de prueba...' : 'Guardando y publicando tu página...';
  const saved = isTestAccount ? 'Prueba guardada. Nada se publicó.' : 'Listo. Tu página se está publicando.';

  return (
    <>
      <h1 className="pt-title">Mi página</h1>

      <section className="pt-block">
        <h2 className="pt-h2">Foto de perfil</h2>
        <ActionForm
          key={`photo-${artist.photo || ''}`}
          action={saveOwnArtistPortalAction}
          className="pt-form pt-card"
          savingMessage={saving}
          successMessage={saved}
        >
          <PortalImageField
            name="photoFile"
            label="Cambiar foto"
            emptyLabel="Sin foto"
            currentUrl={photoUrl}
            hint={isTestAccount
              ? 'En la cuenta de prueba las imágenes no se guardan.'
              : 'Cuadrada y con buena luz: es la que sale arriba en tu página y en el directorio.'}
          />
          <SubmitButton className="primary" pendingText="Guardando...">Guardar foto</SubmitButton>
        </ActionForm>
      </section>

      <section className="pt-block">
        <h2 className="pt-h2">Redes y plataformas</h2>
        <ActionForm action={saveOwnArtistPortalAction} className="pt-form pt-card" savingMessage={saving} successMessage={saved}>
          <p className="pt-help">Pega el enlace de cada una. Si dejas una vacía, no aparece en tu página.</p>
          <div className="pt-fields">
            {SOCIAL_KEYS.map(key => (
              <label key={key}>
                {SOCIAL_LABELS[key]}
                <input type="url" name={key} defaultValue={artist.links?.[key] || ''} placeholder="https://..." />
              </label>
            ))}
          </div>

          <h3 className="pt-h3">Botones de arriba</h3>
          <p className="pt-help">Las dos plataformas que quieres destacar junto a tu nombre. Deben ser distintas y tener enlace.</p>
          <div className="pt-fields">
            <label>
              Botón principal
              <select name="heroPrimary" defaultValue={hero.primary || ''}>
                <option value="">Elegir</option>
                {SOCIAL_KEYS.map(key => (
                  <option key={key} value={key}>{SOCIAL_LABELS[key]}{artist.links?.[key] ? '' : ' (sin enlace)'}</option>
                ))}
              </select>
            </label>
            <label>
              Botón secundario
              <select name="heroSecondary" defaultValue={hero.secondary || ''}>
                <option value="">Elegir</option>
                {SOCIAL_KEYS.map(key => (
                  <option key={key} value={key}>{SOCIAL_LABELS[key]}{artist.links?.[key] ? '' : ' (sin enlace)'}</option>
                ))}
              </select>
            </label>
          </div>

          <h3 className="pt-h3">Orden de las redes</h3>
          <SocialOrderEditor initialOrder={artist.socialOrder} links={artist.links} />

          <SubmitButton className="primary" pendingText="Guardando...">Guardar redes</SubmitButton>
        </ActionForm>
      </section>

      <p className="pt-foot">
        Tu nombre, tu frase y los colores de la página los maneja Lujo Urban. Si quieres cambiar alguno, escríbenos.
      </p>
    </>
  );
}
