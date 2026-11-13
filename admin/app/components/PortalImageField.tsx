'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

// Campo de imagen del portal del artista: muestra la imagen actual, y al
// elegir una nueva la reduce en el navegador antes de enviarla. Las fotos de
// celular pesan varios MB y las imagenes del sitio viven en el repositorio,
// asi que no se sube nada mas grande de lo que la pagina necesita.
//
// La caja de vista previa y la linea de estado tienen tamano fijo: nada se
// mueve al elegir, cambiar o quitar una imagen.

const MAX_SIDE = 1400;
const JPEG_QUALITY = 0.86;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

type FieldState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'ready'; summary: string }
  | { kind: 'error'; message: string };

type PortalImageFieldProps = {
  name: string;
  label: string;
  hint: string;
  // Imagen que hoy esta publicada (URL completa). Vacio = todavia no hay.
  currentUrl?: string;
  emptyLabel: string;
};

const formatSize = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('unreadable'));
  };
  image.src = url;
});

const shrink = async (file: File) => {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas');
  // Fondo negro por si la imagen trae transparencia (el JPG no la conserva).
  context.fillStyle = '#000';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('encode');

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagen';
  return { file: new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }), width, height };
};

export function PortalImageField({ name, label, hint, currentUrl = '', emptyLabel }: PortalImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<FieldState>({ kind: 'idle' });
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const clear = (next: FieldState) => {
    if (inputRef.current) inputRef.current.value = '';
    setPreviewUrl('');
    setState(next);
  };

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) {
      clear({ kind: 'idle' });
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      clear({ kind: 'error', message: 'Ese archivo no sirve. Usa una imagen JPG, PNG o WebP.' });
      return;
    }

    setState({ kind: 'working' });
    try {
      const result = await shrink(file);
      const transfer = new DataTransfer();
      transfer.items.add(result.file);
      input.files = transfer.files;
      setPreviewUrl(URL.createObjectURL(result.file));
      setState({
        kind: 'ready',
        summary: `Lista para publicar · ${result.width} × ${result.height} px · ${formatSize(result.file.size)}`
      });
    } catch {
      clear({ kind: 'error', message: 'No pude leer esa imagen. Prueba con otra.' });
    }
  };

  const shownUrl = previewUrl || currentUrl;
  const statusText = state.kind === 'working'
    ? 'Preparando la imagen...'
    : state.kind === 'ready'
      ? state.summary
      : state.kind === 'error'
        ? state.message
        : hint;

  return (
    <div className="portal-image-field">
      <span className={`portal-image-preview${previewUrl ? ' is-new' : ''}`}>
        {shownUrl ? <img src={shownUrl} alt="" /> : <small>{emptyLabel}</small>}
      </span>
      <label>
        {label}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={ACCEPTED.join(',')}
          onChange={handleChange}
          aria-describedby={`${name}-status`}
        />
        <small
          id={`${name}-status`}
          className={`portal-image-status${state.kind === 'error' ? ' is-error' : ''}${state.kind === 'ready' ? ' is-ready' : ''}`}
          role={state.kind === 'error' ? 'alert' : undefined}
        >
          {statusText}
        </small>
      </label>
      <button
        type="button"
        className="portal-image-clear"
        onClick={() => clear({ kind: 'idle' })}
        disabled={state.kind !== 'ready'}
      >
        Quitar
      </button>
    </div>
  );
}
