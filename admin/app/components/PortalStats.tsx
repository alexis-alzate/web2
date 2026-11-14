'use client';

import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { ArtistStats } from '@/lib/artist-stats';

// Estadisticas del artista en su portal: tres cifras, las visitas por dia y
// de donde llegan. Todo con alturas fijas: tocar una barra solo cambia el
// texto de la linea de lectura, nunca el tamano de la tarjeta.

type PortalStatsProps = {
  stats: ArtistStats;
  // La cuenta de prueba no tiene pagina publica y nunca registra visitas.
  isTestAccount?: boolean;
};

const formatNumber = (value: number) => new Intl.NumberFormat('es-CO').format(value);

const formatDay = (dateKey: string) => new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC'
}).format(new Date(`${dateKey}T12:00:00Z`)).replace('.', '');

const plural = (count: number, one: string, many: string) => `${formatNumber(count)} ${count === 1 ? one : many}`;

const Tile = ({ label, value, previous }: { label: string; value: number; previous: number }) => (
  <div className="portal-stats-tile">
    <span>{label}</span>
    <strong>{formatNumber(value)}</strong>
    <small>Antes: {formatNumber(previous)}</small>
  </div>
);

export function PortalStats({ stats, isTestAccount = false }: PortalStatsProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const days = stats.daily;
  const maxVisitors = Math.max(1, ...days.map(day => day.visitors));
  const maxSource = Math.max(1, ...stats.sources.map(source => source.visitors));
  const activeDay = activeIndex === null ? null : days[activeIndex];

  const indexFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / Math.max(1, box.width);
    return Math.min(days.length - 1, Math.max(0, Math.floor(ratio * days.length)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const start = activeIndex ?? days.length - 1;
    const next = event.key === 'ArrowLeft' ? start - 1 : start + 1;
    setActiveIndex(Math.min(days.length - 1, Math.max(0, next)));
  };

  const heading = (
    <div className="artist-portal-card-heading">
      <span aria-hidden="true">
        <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M3 13V8M8 13V3M13 13V6" />
        </svg>
      </span>
      <div>
        <p className="eyebrow">Tu página</p>
        <h2>Últimos {stats.periodDays} días</h2>
      </div>
    </div>
  );

  if (stats.failed || !stats.hasData) {
    return (
      <section className="artist-portal-card portal-stats">
        {heading}
        <p className="artist-portal-help portal-stats-empty">
          {stats.failed
            ? 'No pudimos cargar tus estadísticas en este momento. Tu perfil sigue funcionando normal; vuelve a intentarlo más tarde.'
            : isTestAccount
              ? 'La cuenta de prueba no tiene página pública, así que no registra visitas.'
              : `Todavía no hay visitas en los últimos ${stats.periodDays} días. Comparte tu página y aquí vas a ver cuánta gente entra, cuántos escuchan y de dónde llegan.`}
        </p>
      </section>
    );
  }

  return (
    <section className="artist-portal-card portal-stats">
      {heading}

      <div className="portal-stats-tiles">
        <Tile label="Visitas" value={stats.visitors} previous={stats.previous.visitors} />
        <Tile label="Escucharon" value={stats.listens} previous={stats.previous.listens} />
        <Tile label="Compartieron" value={stats.shares} previous={stats.previous.shares} />
      </div>

      <div className="portal-stats-block">
        <div className="portal-stats-block-heading">
          <h3>Visitas por día</h3>
          <span aria-live="polite">
            {activeDay
              ? `${formatDay(activeDay.date)} · ${plural(activeDay.visitors, 'visita', 'visitas')}`
              : 'Toca una barra para ver el día'}
          </span>
        </div>
        <div
          className="portal-stats-plot"
          role="group"
          tabIndex={0}
          aria-label={`Visitas por día en los últimos ${stats.periodDays} días. Usa las flechas para recorrer los días.`}
          onPointerMove={event => setActiveIndex(indexFromPointer(event))}
          onPointerDown={event => setActiveIndex(indexFromPointer(event))}
          onPointerLeave={event => {
            if (event.pointerType === 'mouse') setActiveIndex(null);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setActiveIndex(null)}
        >
          {days.map((day, index) => (
            <span key={day.date} className={`portal-stats-bar-slot${index === activeIndex ? ' is-active' : ''}`}>
              <span
                className={`portal-stats-bar${day.visitors === 0 ? ' is-zero' : ''}`}
                style={{ height: day.visitors === 0 ? undefined : `${Math.max(6, (day.visitors / maxVisitors) * 100)}%` }}
              />
            </span>
          ))}
        </div>
        <div className="portal-stats-axis" aria-hidden="true">
          <span>{formatDay(days[0].date)}</span>
          <span>Hoy</span>
        </div>
        <table className="portal-stats-table">
          <caption>Visitas por día</caption>
          <thead><tr><th scope="col">Día</th><th scope="col">Visitas</th></tr></thead>
          <tbody>
            {days.map(day => (
              <tr key={day.date}><th scope="row">{formatDay(day.date)}</th><td>{day.visitors}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats.sources.length ? (
        <div className="portal-stats-block">
          <div className="portal-stats-block-heading">
            <h3>De dónde llegan</h3>
          </div>
          <ul className="portal-stats-sources">
            {stats.sources.map(source => (
              <li key={source.key}>
                <span>{source.label}</span>
                <span className="portal-stats-source-track" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, (source.visitors / maxSource) * 100)}%` }} />
                </span>
                <b>{formatNumber(source.visitors)}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="portal-stats-note">
        Contamos una visita por persona y por día. «Antes» son los {stats.periodDays} días anteriores.
        Quien llega desde WhatsApp suele aparecer como enlace directo.
      </p>
    </section>
  );
}
