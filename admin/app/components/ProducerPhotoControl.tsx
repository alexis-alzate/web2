import { removeProducerPhotoAction } from '../producer-profile-actions';
import { ActionForm } from './ActionForm';
import { SubmitButton } from './SubmitButton';

// Foto del productor dentro de su tarjeta del panel: se ve la que subio y el
// admin puede quitarla (por ejemplo si sube algo que no va). Subirla es cosa
// del productor, desde su portal. Recibe todo por props.

type ProducerPhotoControlProps = {
  producerId: string;
  stageName: string;
  // URL completa de la foto; vacio = no tiene.
  photoUrl: string;
};

export function ProducerPhotoControl({ producerId, stageName, photoUrl }: ProducerPhotoControlProps) {
  if (!photoUrl) return <p className="muted">Sin foto en su tienda.</p>;

  return (
    <ActionForm
      action={removeProducerPhotoAction}
      className="grid"
      savingMessage="Quitando la foto..."
      successMessage="Foto quitada."
    >
      <input name="producerId" type="hidden" value={producerId} />
      <p className="muted">
        <img src={photoUrl} alt={`Foto de ${stageName}`} width="40" height="40" style={{ borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', marginRight: 8 }} />
        Foto en su tienda
      </p>
      <SubmitButton pendingText="...">Quitar foto</SubmitButton>
    </ActionForm>
  );
}
