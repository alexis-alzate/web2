'use client';

import { useState } from 'react';
import {
  SOCIAL_LABELS,
  normalizeSocialOrder,
  type SocialKey
} from '@/lib/socials';

type SocialOrderEditorProps = {
  initialOrder?: readonly string[];
  links?: Record<string, string>;
  name?: string;
};

export function SocialOrderEditor({
  initialOrder,
  links = {},
  name = 'socialOrder'
}: SocialOrderEditorProps) {
  const [order, setOrder] = useState<SocialKey[]>(() => normalizeSocialOrder(initialOrder));
  const [draggedKey, setDraggedKey] = useState<SocialKey | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const move = (key: SocialKey, direction: -1 | 1) => {
    setOrder(current => {
      const from = current.indexOf(key);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      setAnnouncement(`${SOCIAL_LABELS[key]} quedo en la posicion ${to + 1}.`);
      return next;
    });
  };

  const placeBefore = (targetKey: SocialKey) => {
    if (!draggedKey || draggedKey === targetKey) return;
    setOrder(current => {
      const next = current.filter(key => key !== draggedKey);
      const targetIndex = next.indexOf(targetKey);
      next.splice(targetIndex, 0, draggedKey);
      setAnnouncement(`${SOCIAL_LABELS[draggedKey]} quedo en la posicion ${targetIndex + 1}.`);
      return next;
    });
    setDraggedKey(null);
  };

  return (
    <div className="social-order-editor">
      <input type="hidden" name={name} value={order.join(',')} readOnly />
      <p className="social-order-note">
        Este orden solo cambia las tarjetas verdes de redes. La plantilla permanece igual.
      </p>
      <ol className="social-order-list">
        {order.map((key, index) => (
          <li
            key={key}
            draggable
            onDragStart={() => setDraggedKey(key)}
            onDragEnd={() => setDraggedKey(null)}
            onDragOver={event => event.preventDefault()}
            onDrop={() => placeBefore(key)}
            className={draggedKey === key ? 'is-dragging' : ''}
          >
            <span className="social-order-handle" aria-hidden="true">⋮⋮</span>
            <span className="social-order-position">{index + 1}</span>
            <span className="social-order-name">
              <strong>{SOCIAL_LABELS[key]}</strong>
              <small>{links[key] ? 'Enlace configurado' : 'Sin enlace: no se muestra'}</small>
            </span>
            <span className="social-order-controls">
              <button
                type="button"
                onClick={() => move(key, -1)}
                disabled={index === 0}
                aria-label={`Subir ${SOCIAL_LABELS[key]}`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(key, 1)}
                disabled={index === order.length - 1}
                aria-label={`Bajar ${SOCIAL_LABELS[key]}`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </div>
  );
}
