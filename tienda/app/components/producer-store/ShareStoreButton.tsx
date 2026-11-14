'use client';

import { useEffect, useRef, useState } from 'react';
import { ShareIcon, CheckIcon } from '../Icons';

// Compartir la tienda: hoja nativa del celular si existe; si no, copia el
// enlace. El boton es de tamano fijo: solo cambia el icono y el aviso, que
// vive en una capa aparte y no empuja nada.
export default function ShareStoreButton({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} — Lujo Urban`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      // El usuario cerro la hoja de compartir o el navegador no dejo copiar.
    }
  };

  return (
    <span className="pstore-share-wrap">
      <button
        type="button"
        className="pstore-share"
        onClick={share}
        aria-label="Compartir esta tienda"
      >
        {copied ? <CheckIcon /> : <ShareIcon />}
      </button>
      <span className="pstore-share-note" role="status" aria-live="polite">
        {copied ? 'Enlace copiado' : ''}
      </span>
    </span>
  );
}
