'use client';

import { useRef, useState } from 'react';

// "Tu enlace": la direccion que el artista pone en su bio, con un boton para
// copiarla. El boton tiene ancho fijo: al copiar solo cambia el texto.

type PortalLinkProps = {
  // Direccion completa, con https://.
  url: string;
  // true = es el enlace corto; false = todavia usa la direccion larga.
  isShort: boolean;
};

export function PortalLink({ url, isShort }: PortalLinkProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | null>(null);
  const display = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  const copy = async () => {
    let next: 'copied' | 'failed' = 'copied';
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      next = 'failed';
    }
    setStatus(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus('idle'), 2200);
  };

  return (
    <section className="artist-portal-card portal-link">
      <div className="portal-link-text">
        <p className="eyebrow">{isShort ? 'Tu enlace corto' : 'Tu enlace'}</p>
        <a href={url} target="_blank" rel="noreferrer">{display}</a>
        <small>
          {isShort
            ? 'Ponlo en la bio de Instagram y TikTok.'
            : 'Pídele a Lujo Urban tu enlace corto para la bio.'}
        </small>
      </div>
      <button type="button" className="button portal-link-copy" onClick={copy} aria-live="polite">
        {status === 'copied' ? 'Copiado' : status === 'failed' ? 'No se pudo' : 'Copiar'}
      </button>
    </section>
  );
}
