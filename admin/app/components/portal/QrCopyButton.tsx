'use client';

import { useRef, useState } from 'react';
import { qrPath } from '@/lib/artist-qr';
import { copyImageToClipboard, fetchPngBlob } from '@/lib/clipboard-image';

// "Copiar QR": deja la imagen del QR en el portapapeles para pegarla en
// WhatsApp, Instagram, etc., como hace Instagram con su QR. Solo maneja el
// estado del boton; la logica de copiar vive en lib/clipboard-image.ts.
// El boton ocupa siempre el mismo lugar: al copiar solo cambia el texto.

type Status = 'idle' | 'copied' | 'failed' | 'unsupported';

const LABELS: Record<Status, string> = {
  idle: 'Copiar QR',
  copied: 'Copiado, pégalo donde quieras',
  failed: 'No se pudo copiar',
  unsupported: 'Tu navegador no copia imágenes'
};

export function QrCopyButton() {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<number | null>(null);

  const copy = async () => {
    const result = await copyImageToClipboard(
      () => fetchPngBlob(qrPath('png')),
      {
        clipboard: navigator.clipboard,
        ClipboardItem: typeof ClipboardItem === 'undefined' ? undefined : ClipboardItem
      }
    );
    setStatus(result);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus('idle'), 2800);
  };

  return (
    <button type="button" className="pt-qr-btn is-main is-wide" onClick={copy} aria-live="polite">
      {LABELS[status]}
    </button>
  );
}
