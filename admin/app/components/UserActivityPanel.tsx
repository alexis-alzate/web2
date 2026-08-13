'use client';

import { useEffect, useState } from 'react';
import {
  PORTAL_ONLINE_WINDOW_SECONDS,
  type PortalUserActivity
} from '@/lib/portal-activity-types';

type UserActivityPanelProps = {
  activity?: PortalUserActivity;
  trackingAvailable: boolean;
  generatedAt: string;
};

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

const deviceLabels: Record<string, string> = {
  desktop: 'Computador',
  mobile: 'Móvil',
  tablet: 'Tablet',
  unknown: 'Dispositivo no identificado'
};

const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  if (safeSeconds < 60) return 'Menos de 1 min';
  const minutes = Math.floor(safeSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
};

const formatRelative = (date: string, now: number) => {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Ahora mismo';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return dateFormatter.format(new Date(date));
};

export function UserActivityPanel({ activity, trackingAvailable, generatedAt }: UserActivityPanelProps) {
  const [now, setNow] = useState(() => new Date(generatedAt).getTime());

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!trackingAvailable) {
    return (
      <section className="artist-activity artist-activity-unavailable">
        <strong>Actividad de usuario</strong>
        <span>El registro quedará activo al instalar la migración de sesiones.</span>
      </section>
    );
  }

  if (!activity) {
    return (
      <section className="artist-activity artist-activity-empty">
        <span className="artist-activity-status">Sin actividad</span>
        <strong>Aún no hay inicios registrados</strong>
        <small>El historial comenzará automáticamente en el próximo ingreso de esta cuenta.</small>
      </section>
    );
  }

  const session = activity.lastSession;
  const lastSeenMs = new Date(session.lastSeenAt).getTime();
  const startedAtMs = new Date(session.startedAt).getTime();
  const online = !session.endedAt
    && now - lastSeenMs <= PORTAL_ONLINE_WINDOW_SECONDS * 1000;
  const liveSessionSeconds = online
    ? Math.max(session.durationSeconds, (now - startedAtMs) / 1000)
    : session.durationSeconds;
  const liveTotalSeconds = online
    ? activity.totalActiveSeconds + Math.max(0, (now - lastSeenMs) / 1000)
    : activity.totalActiveSeconds;

  return (
    <section className="artist-activity">
      <header className="artist-activity-heading">
        <span>
          <small>Actividad del usuario</small>
          <strong>{online ? 'Usando el portal ahora' : 'Historial del portal'}</strong>
        </span>
        <span className={`artist-activity-status ${online ? 'is-online' : ''}`}>
          <i aria-hidden="true" />
          {online ? 'En línea' : 'Desconectado'}
        </span>
      </header>

      <div className="artist-activity-metrics">
        <span>
          <small>Ingresos</small>
          <strong>{activity.loginCount}</strong>
        </span>
        <span>
          <small>{online ? 'Sesión actual' : 'Última sesión'}</small>
          <strong>{formatDuration(liveSessionSeconds)}</strong>
        </span>
        <span>
          <small>Tiempo acumulado</small>
          <strong>{formatDuration(liveTotalSeconds)}</strong>
        </span>
      </div>

      <div className="artist-activity-last-login">
        <span>
          <small>Último ingreso</small>
          <strong>{dateFormatter.format(new Date(activity.lastLoginAt))}</strong>
        </span>
        <span>
          <small>Dispositivo</small>
          <strong>{deviceLabels[session.deviceType] || deviceLabels.unknown}</strong>
        </span>
      </div>

      <details className="artist-activity-events">
        <summary>Ver actividad reciente ({activity.events.length})</summary>
        {activity.events.length ? (
          <ol>
            {activity.events.map(event => (
              <li key={event.id}>
                <i aria-hidden="true" />
                <span>
                  <strong>{event.label}</strong>
                  <small>{formatRelative(event.createdAt, now)}</small>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p>No hay acciones adicionales registradas.</p>
        )}
      </details>
    </section>
  );
}
