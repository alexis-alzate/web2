import type { ProducerAccessInfo } from '@/lib/producers';
import {
  inviteProducerAccessAction,
  setProducerAccessStatusAction,
  unlinkProducerAccessAction
} from '../producer-access-actions';
import { ActionForm } from './ActionForm';
import { SubmitButton } from './SubmitButton';

// Acceso de UN productor dentro de su tarjeta del panel: invitarlo, pausar o
// reactivar su entrada, o cambiar su correo. Recibe todo por props; las
// reglas viven en ProducerAccessService.

const STATUS_LABELS = { active: 'Activo', suspended: 'Pausado', inactive: 'Inactivo' } as const;

type ProducerAccessProps = {
  producerId: string;
  stageName: string;
  // Solo un productor activo puede recibir acceso.
  producerActive: boolean;
  access: ProducerAccessInfo | undefined;
};

export function ProducerAccess({ producerId, stageName, producerActive, access }: ProducerAccessProps) {
  if (!access) {
    if (!producerActive) {
      return <p className="muted">Activa al productor para poder darle acceso al portal.</p>;
    }

    return (
      <ActionForm
        action={inviteProducerAccessAction}
        className="artist-access-invite"
        savingMessage={`Creando el acceso de ${stageName}...`}
        successMessage="Invitación enviada. Le llega un correo para crear su clave."
        resetOnSuccess
      >
        <input type="hidden" name="producerId" value={producerId} />
        <label>
          Correo para su portal
          <input type="email" name="email" placeholder="productor@correo.com" required />
        </label>
        <SubmitButton className="primary" pendingText="Enviando...">Invitar al portal</SubmitButton>
      </ActionForm>
    );
  }

  return (
    <div className="artist-access-account">
      <div className="artist-access-copy">
        <strong>{access.email}</strong>
        <small>{access.confirmed ? 'Ya creó su clave' : 'Invitación pendiente: aún no crea su clave'}</small>
        <span className={`artist-access-badge is-${access.status}`}>{STATUS_LABELS[access.status]}</span>
      </div>
      <ActionForm
        action={setProducerAccessStatusAction}
        className="artist-access-status-form"
        savingMessage={`Actualizando el acceso de ${stageName}...`}
        successMessage="Acceso actualizado."
      >
        <input type="hidden" name="userId" value={access.userId} />
        <label>
          Estado
          <select name="accessStatus" defaultValue={access.status}>
            <option value="active">Activo</option>
            <option value="suspended">Pausado</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
        <SubmitButton pendingText="Guardando...">Guardar</SubmitButton>
      </ActionForm>
      <details className="artist-access-emergency">
        <summary>Cambiar el correo</summary>
        <p className="muted">
          Suelta este correo para poder invitar a otro. Si todavía no había creado su clave, la invitación se borra.
        </p>
        <ActionForm
          action={unlinkProducerAccessAction}
          className="artist-access-unlink-form"
          savingMessage={`Desvinculando ${access.email}...`}
          successMessage="Correo desvinculado. Ya puedes invitar al nuevo."
        >
          <input type="hidden" name="userId" value={access.userId} />
          <label>
            Escribe DESVINCULAR
            <input name="confirmation" autoComplete="off" required />
          </label>
          <SubmitButton className="danger" pendingText="Desvinculando...">Desvincular correo</SubmitButton>
        </ActionForm>
      </details>
    </div>
  );
}
