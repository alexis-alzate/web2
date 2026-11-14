import { APPLICATION_STATUS_LABELS, DEFAULT_COMMISSION_PERCENT } from '@/lib/producer-applications/rules';
import type { ProducerApplication } from '@/lib/producer-applications/types';
import {
  approveProducerApplicationAction,
  rejectProducerApplicationAction
} from '../actions-producer-applications';
import { ActionForm } from './ActionForm';
import { SubmitButton } from './SubmitButton';

// Solicitudes de productores (formulario www.lujourban.com/vender/). Recibe
// todo por props; las reglas viven en ProducerApplicationService. Aprobar crea
// al productor y le envia la invitacion para crear su clave.

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

type ProducerApplicationsProps = {
  applications: ProducerApplication[];
  available: boolean;
};

export function ProducerApplications({ applications, available }: ProducerApplicationsProps) {
  const pending = applications.filter(item => item.status === 'new');
  // Primero las que hay que revisar; el resto queda como historial.
  const ordered = [...pending, ...applications.filter(item => item.status !== 'new')];

  return (
    <section className="section">
      <details className="folder">
        <summary>
          <span className="module-summary">
            <span>
              <strong>Solicitudes de productores</strong>
              <small>
                {available
                  ? `${pending.length} por revisar · ${applications.length} en total`
                  : 'Falta correr la migracion 021'}
              </small>
            </span>
          </span>
        </summary>
        <div className="folder-body">
          {!available && (
            <p className="muted">
              No pude leer las solicitudes. Corre supabase/migrations/021_producer_applications.sql en el SQL Editor de Supabase.
            </p>
          )}
          {available && applications.length === 0 && (
            <p className="muted">
              Todavia no hay solicitudes. Llegan desde el formulario de www.lujourban.com/vender/.
            </p>
          )}
          {ordered.length > 0 && (
            <ol className="cards request-list">
              {ordered.map(item => (
                <li className="card request-card" key={item.id}>
                  <div className="request-info">
                    <h3>{item.stageName}</h3>
                    <p className="request-meta">
                      <span className={`request-status request-status-${item.status}`}>
                        {APPLICATION_STATUS_LABELS[item.status]}
                      </span>
                      <span>{formatDate(item.createdAt)}</span>
                    </p>
                    <p className="request-links">
                      <a href={`mailto:${item.email}`}>{item.email}</a>
                      <a href={item.musicUrl} target="_blank" rel="noopener noreferrer">
                        {hostOf(item.musicUrl)}
                      </a>
                    </p>
                  </div>
                  {item.status === 'new' && (
                    <div className="request-actions">
                      <ActionForm
                        className="request-approve"
                        action={approveProducerApplicationAction}
                        savingMessage="Aprobando y enviando la invitacion..."
                        successMessage="Aprobada. Le enviamos la invitacion."
                      >
                        <input name="id" type="hidden" value={item.id} />
                        <label>
                          Comision (%)
                          <input
                            name="commission"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step="0.01"
                            defaultValue={DEFAULT_COMMISSION_PERCENT}
                          />
                        </label>
                        <SubmitButton className="primary" pendingText="Aprobando...">Aprobar</SubmitButton>
                      </ActionForm>
                      <ActionForm
                        className="request-reject"
                        action={rejectProducerApplicationAction}
                        savingMessage="Rechazando solicitud..."
                        successMessage="Solicitud rechazada."
                      >
                        <input name="id" type="hidden" value={item.id} />
                        <SubmitButton pendingText="Rechazando...">Rechazar</SubmitButton>
                      </ActionForm>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </details>
    </section>
  );
}
