'use client';

import { useEffect, useState } from 'react';

type PreviewState = {
  title: string;
  slug: string;
  featuring: string;
  description: string;
  heroText: string;
  version: string;
};

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const readField = (form: HTMLFormElement | null, name: string) => {
  if (!form) return '';
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement
    ? field.value.trim()
    : '';
};

export function ReleasePreview() {
  const [preview, setPreview] = useState<PreviewState>({
    title: '',
    slug: '',
    featuring: '',
    description: '',
    heroText: 'Música con propósito. Sonidos que trascienden.',
    version: ''
  });

  useEffect(() => {
    const form = document.querySelector<HTMLFormElement>('[data-release-form]');
    if (!form) return;

    const updatePreview = () => {
      const title = readField(form, 'title');
      const slug = readField(form, 'slug') || slugify(title || 'nuevo-lanzamiento');
      const featuring = readField(form, 'featuring');
      const socialArtist = featuring ? `Zaetta ft. ${featuring}` : 'Zaetta';
      const description = readField(form, 'socialDescription') || (
        title ? `Escucha ${title}, el nuevo lanzamiento de ${socialArtist}.` : 'Escucha el nuevo lanzamiento de Zaetta.'
      );

      setPreview({
        title,
        slug,
        featuring,
        description,
        heroText: readField(form, 'heroText') || 'Música con propósito. Sonidos que trascienden.',
        version: readField(form, 'version') || 'auto'
      });
    };

    updatePreview();
    form.addEventListener('input', updatePreview);
    form.addEventListener('change', updatePreview);

    return () => {
      form.removeEventListener('input', updatePreview);
      form.removeEventListener('change', updatePreview);
    };
  }, []);

  const visibleTitle = preview.title || 'Nuevo lanzamiento';
  const visibleArtist = preview.featuring ? `Zaetta ft. ${preview.featuring}` : 'Zaetta';
  const visibleSlug = preview.slug || 'nuevo-lanzamiento';
  const visibleVersion = preview.version === 'auto' ? 'v-auto' : `v${preview.version}`;

  return (
    <aside className="release-preview span-2" aria-live="polite">
      <div className="release-preview-head">
        <span>Vista previa social</span>
        <small>Antes de publicar</small>
      </div>
      <div className="release-preview-card">
        <div className="release-preview-cover">
          <span>OG</span>
        </div>
        <div className="release-preview-copy">
          <strong>{visibleTitle} - {visibleArtist}</strong>
          <p>{preview.description}</p>
          <small>Chat: lujourban.com/lanzamientos/{visibleSlug}-{visibleVersion}/</small>
          <small>Estado: lujourban.com/estados/{visibleSlug}-{visibleVersion}/</small>
        </div>
      </div>
      <p className="release-preview-note">
        Al publicar, el panel crea un link para chat y otro link separado para estados de WhatsApp.
      </p>
    </aside>
  );
}
