'use client';

import { useRef, useState } from 'react';
import { displayUrl } from '@/lib/producers/store-url';

// "Tu tienda": la direccion publica del productor, con botones para abrirla y
// copiarla. Los botones tienen ancho fijo: al copiar solo cambia la palabra.

type ProducerStoreLinkProps = {
  // Direccion completa, con https://.
  url: string;
};

export function ProducerStoreLink({ url }: ProducerStoreLinkProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | null>(null);

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
    <section className="artist-portal-card portal-link pt-prod-store" aria-label="Tu tienda">
      <div className="portal-link-text">
        <p className="eyebrow">Tu tienda</p>
        <a href={url} target="_blank" rel="noopener noreferrer">{displayUrl(url)}</a>
        <small>Es pública: compártela con quien quiera tus beats.</small>
      </div>
      <div className="pt-prod-store-actions">
        <a className="button portal-link-copy" href={url} target="_blank" rel="noopener noreferrer">Abrir</a>
        <button type="button" className="button portal-link-copy" onClick={copy} aria-live="polite">
          {status === 'copied' ? 'Copiado' : status === 'failed' ? 'No se pudo' : 'Copiar'}
        </button>
      </div>
    </section>
  );
}
