'use client';

import { useState } from 'react';

type CopyLinkButtonProps = {
  url: string;
  title?: string;
  text?: string;
  children: React.ReactNode;
};

export function CopyLinkButton({ url, title = 'LUJO URBAN', text = 'Mira este lanzamiento.', children }: CopyLinkButtonProps) {
  const [status, setStatus] = useState<'idle' | 'shared' | 'copied'>('idle');

  const resetStatus = (nextStatus: 'shared' | 'copied') => {
    setStatus(nextStatus);
    window.setTimeout(() => setStatus('idle'), 1800);
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        resetStatus('shared');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    await navigator.clipboard.writeText(url);
    resetStatus('copied');
  };

  const label = status === 'shared'
    ? 'Compartido'
    : status === 'copied'
      ? 'Copiado'
      : children;

  return (
    <button type="button" onClick={share} className="button">
      {label}
    </button>
  );
}
