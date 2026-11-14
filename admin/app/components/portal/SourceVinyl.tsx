'use client';

import { useState } from 'react';
import type { ArtistSourceStat } from '@/lib/artist-stats';
import { formatNumber, percent } from '@/lib/portal-format';

// "De donde llegan" dibujado como un disco: cada tramo del anillo es una
// fuente de visitas y el centro (la etiqueta del disco) muestra el total o
// la fuente seleccionada. Los tramos van de mayor a menor en un solo tono
// (verde claro -> oscuro); el nombre y la cifra siempre estan en la lista de
// al lado, asi el color nunca es lo unico que identifica una fuente.

const RADIUS = 62;
const STROKE = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;
// Un tono, de claro a oscuro. "Otros sitios" y lo que no dice de donde viene
// usan el neutro.
const RAMP = ['#39ff63', '#29c24c', '#1f9a3e', '#1a7d33', '#176a2c'];
const NEUTRAL = '#667068';

const colorOf = (source: ArtistSourceStat, index: number) =>
  source.key === 'other' ? NEUTRAL : RAMP[Math.min(index, RAMP.length - 1)];

export function SourceVinyl({ sources }: { sources: ArtistSourceStat[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const total = sources.reduce((sum, source) => sum + source.visitors, 0);
  const active = sources.find(source => source.key === activeKey) ?? null;

  let offset = 0;
  const arcs = sources.map((source, index) => {
    const length = (source.visitors / Math.max(1, total)) * CIRCUMFERENCE;
    const visible = Math.max(1, length - (sources.length > 1 ? GAP : 0));
    const arc = { source, color: colorOf(source, index), dash: `${visible} ${CIRCUMFERENCE - visible}`, offset: -offset };
    offset += length;
    return arc;
  });

  return (
    <div className="pt-vinyl">
      <svg className="pt-vinyl-disc" viewBox="0 0 180 180" role="img" aria-label={`Visitas por origen: ${sources.map(source => `${source.label} ${source.visitors}`).join(', ')}.`}>
        <g transform="rotate(-90 90 90)">
          {arcs.map(arc => (
            <circle
              key={arc.source.key}
              cx="90" cy="90" r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeDasharray={arc.dash}
              strokeDashoffset={arc.offset}
              className={`pt-vinyl-arc${activeKey && activeKey !== arc.source.key ? ' is-dim' : ''}`}
              onPointerEnter={() => setActiveKey(arc.source.key)}
              onPointerLeave={event => {
                if (event.pointerType === 'mouse') setActiveKey(null);
              }}
            />
          ))}
        </g>
        {/* Surcos del disco: dos lineas finas sobre el anillo. */}
        <circle cx="90" cy="90" r="68" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1" pointerEvents="none" />
        <circle cx="90" cy="90" r="56" fill="none" stroke="rgba(0,0,0,.28)" strokeWidth="1" pointerEvents="none" />
        <circle cx="90" cy="90" r="43" className="pt-vinyl-label" pointerEvents="none" />
        <text x="90" y="92" textAnchor="middle" className="pt-vinyl-number">{formatNumber(active ? active.visitors : total)}</text>
        <text x="90" y="109" textAnchor="middle" className="pt-vinyl-caption">{active ? percent(active.visitors, total) : 'visitas'}</text>
      </svg>

      <ul className="pt-vinyl-list">
        {arcs.map(arc => (
          <li key={arc.source.key}>
            <button
              type="button"
              className={`pt-vinyl-row${activeKey === arc.source.key ? ' is-active' : ''}`}
              aria-pressed={activeKey === arc.source.key}
              onClick={() => setActiveKey(activeKey === arc.source.key ? null : arc.source.key)}
              onPointerEnter={event => {
                if (event.pointerType === 'mouse') setActiveKey(arc.source.key);
              }}
              onPointerLeave={event => {
                if (event.pointerType === 'mouse') setActiveKey(null);
              }}
            >
              <i style={{ background: arc.color }} aria-hidden="true" />
              <span>{arc.source.label}</span>
              <b>{formatNumber(arc.source.visitors)}</b>
              <small>{percent(arc.source.visitors, total)}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
