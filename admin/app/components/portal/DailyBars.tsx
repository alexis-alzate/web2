'use client';

import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { ArtistDailyStat } from '@/lib/artist-stats';
import { formatDay, plural } from '@/lib/portal-format';

// Visitas por dia como un ecualizador: una barra por dia, los dias sin
// visitas quedan como un punto en la linea base. La caja y la linea de
// lectura tienen alto fijo; tocar una barra solo cambia el texto.

type DailyBarsProps = {
  days: ArtistDailyStat[];
  // false = version pequena de Inicio, sin lectura por dia.
  interactive?: boolean;
};

export function DailyBars({ days, interactive = true }: DailyBarsProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const max = Math.max(1, ...days.map(day => day.visitors));
  const active = activeIndex === null ? null : days[activeIndex];
  const peakIndex = days.reduce((best, day, index) => (day.visitors > days[best].visitors ? index : best), 0);

  const indexFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / Math.max(1, box.width);
    return Math.min(days.length - 1, Math.max(0, Math.floor(ratio * days.length)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const start = activeIndex ?? days.length - 1;
    setActiveIndex(Math.min(days.length - 1, Math.max(0, start + (event.key === 'ArrowLeft' ? -1 : 1))));
  };

  const bars = days.map((day, index) => (
    <span
      key={day.date}
      className={`pt-eq-slot${index === activeIndex ? ' is-active' : ''}${index === peakIndex && day.visitors > 0 ? ' is-peak' : ''}`}
    >
      <span
        className={`pt-eq-bar${day.visitors === 0 ? ' is-zero' : ''}`}
        style={day.visitors === 0 ? undefined : { height: `${Math.max(8, (day.visitors / max) * 100)}%` }}
      />
    </span>
  ));

  if (!interactive) {
    return <div className="pt-eq pt-eq-mini" aria-hidden="true">{bars}</div>;
  }

  return (
    <div className="pt-eq-wrap">
      <p className="pt-eq-readout" aria-live="polite">
        {active
          ? <><b>{formatDay(active.date)}</b> {plural(active.visitors, 'visita', 'visitas')}</>
          : days[peakIndex].visitors > 0
            ? <>Tu mejor día fue el <b>{formatDay(days[peakIndex].date)}</b>, con {plural(days[peakIndex].visitors, 'visita', 'visitas')}</>
            : 'Sin visitas en este periodo'}
      </p>
      <div
        className="pt-eq"
        role="group"
        tabIndex={0}
        aria-label={`Visitas por día en los últimos ${days.length} días. Usa las flechas para recorrer los días.`}
        onPointerMove={event => setActiveIndex(indexFromPointer(event))}
        onPointerDown={event => setActiveIndex(indexFromPointer(event))}
        onPointerLeave={event => {
          if (event.pointerType === 'mouse') setActiveIndex(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setActiveIndex(null)}
      >
        {bars}
      </div>
      <div className="pt-eq-axis" aria-hidden="true">
        <span>{formatDay(days[0].date)}</span>
        <span>Hoy</span>
      </div>
      <table className="pt-sr">
        <caption>Visitas por día</caption>
        <thead><tr><th scope="col">Día</th><th scope="col">Visitas</th></tr></thead>
        <tbody>
          {days.map(day => (
            <tr key={day.date}><th scope="row">{formatDay(day.date)}</th><td>{day.visitors}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
