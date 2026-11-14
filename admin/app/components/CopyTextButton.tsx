'use client';

import { useRef, useState } from 'react';

// Boton que copia un texto al portapapeles. Su ancho es fijo (lo da la clase
// `copy-text-button`): al copiar solo cambia la palabra, nunca el tamano.

type CopyTextButtonProps = {
  text: string;
  label?: string;
  className?: string;
};

export function CopyTextButton({ text, label = 'Copiar', className = '' }: CopyTextButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | null>(null);

  const copy = async () => {
    let next: 'copied' | 'failed' = 'copied';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      next = 'failed';
    }
    setStatus(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus('idle'), 2200);
  };

  return (
    <button type="button" className={`button copy-text-button ${className}`.trim()} onClick={copy} aria-live="polite">
      {status === 'copied' ? 'Copiado' : status === 'failed' ? 'No se pudo' : label}
    </button>
  );
}
