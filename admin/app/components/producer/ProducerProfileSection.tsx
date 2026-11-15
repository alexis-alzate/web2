import { saveProducerProfileAction } from '../../producer-profile-actions';
import { ActionForm } from '../ActionForm';
import { PortalImageField } from '../PortalImageField';
import { SubmitButton } from '../SubmitButton';
import { BioField } from './BioField';

// Foto y descripcion de la tienda del productor. Vista sin lecturas: recibe todo
// por props. La tienda tiene un molde fijo: la foto va en un circulo y la
// descripcion en una o dos lineas, asi que no se puede romper el diseno.

type ProducerProfileSectionProps = {
  bio: string;
  // URL completa de la foto actual; vacio = todavia no hay.
  photoUrl: string;
};

export function ProducerProfileSection({ bio, photoUrl }: ProducerProfileSectionProps) {
  return (
    <section className="pt-block">
      <h2 className="pt-h2">Tu perfil</h2>
      <ActionForm
        key={`${photoUrl}|${bio}`}
        action={saveProducerProfileAction}
        className="pt-form pt-card"
        savingMessage="Guardando tu perfil..."
        successMessage="Perfil guardado. Tu tienda se actualiza en un minuto."
      >
        <PortalImageField
          name="photo"
          label="Tu foto"
          emptyLabel="Sin foto"
          currentUrl={photoUrl}
          hint="Se ve en un círculo arriba de tu tienda. Mejor cuadrada y con buena luz."
        />
        {photoUrl ? (
          <label className="pt-check">
            <input type="checkbox" name="removePhoto" />
            Quitar mi foto actual
          </label>
        ) : null}
        <BioField defaultValue={bio} />
        <SubmitButton className="primary" pendingText="Guardando...">Guardar perfil</SubmitButton>
      </ActionForm>
    </section>
  );
}
