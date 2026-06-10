'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Beat } from '@/lib/types';
import { publicUrl } from '@/lib/format';
import { usePlayer } from '../providers/PlayerProvider';
import BeatRow from './BeatRow';

export default function BeatCatalog({ beats }: { beats: Beat[] }) {
  const [activeGenre, setActiveGenre] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const { setQueue } = usePlayer();

  const genres = useMemo(() => {
    const set = new Set<string>();
    beats.forEach((b) => {
      if (b.genre && b.genre.toLowerCase() !== b.title.toLowerCase()) set.add(b.genre);
    });
    return [...set];
  }, [beats]);

  const filtered = useMemo(() => {
    if (activeGenre === 'all') return beats;
    return beats.filter((b) => b.genre === activeGenre);
  }, [beats, activeGenre]);

  useEffect(() => {
    setQueue(
      filtered
        .filter((b) => b.preview_url)
        .map((b) => ({
          beatId: b.id,
          slug: b.slug,
          title: b.title,
          genre: b.genre,
          coverUrl: publicUrl('beats-covers', b.cover_url),
          previewUrl: publicUrl('beats-previews', b.preview_url),
          price: b.price_basic
        }))
    );
  }, [filtered, setQueue]);

  return (
    <>
      <section className="tienda-section">
        <div className="beats-toolbar">
          <button type="button" className="toolbar-btn">
            <span className="toolbar-btn-icon">🏷</span> Ofertas
          </button>
          {!!genres.length && (
            <button type="button" className="toolbar-btn" onClick={() => setShowFilters((v) => !v)}>
              Filtros <span className="toolbar-btn-icon">☰</span>
            </button>
          )}
        </div>

        {!!genres.length && showFilters && (
          <div className="beats-filters">
            <button
              type="button"
              className={`filter-pill ${activeGenre === 'all' ? 'active' : ''}`}
              onClick={() => setActiveGenre('all')}
            >
              Todos
            </button>
            {genres.map((g) => (
              <button
                key={g}
                type="button"
                className={`filter-pill ${activeGenre === g ? 'active' : ''}`}
                onClick={() => setActiveGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        <div className="beats-list-header">
          <span className="beats-list-header-cell"></span>
          <span className="beats-list-header-cell">Título</span>
          <span className="beats-list-header-cell beats-col-time">Tiempo</span>
          <span className="beats-list-header-cell beats-col-bpm">BPM</span>
          <span className="beats-list-header-cell beats-col-tags">Tags</span>
          <span className="beats-list-header-cell beats-col-share"></span>
          <span className="beats-list-header-cell beats-col-price">Precio</span>
          <span className="beats-list-header-cell"></span>
        </div>

        <div className="beats-list">
          {filtered.length
            ? filtered.map((beat) => <BeatRow key={beat.id} beat={beat} />)
            : <p className="beats-loading">Pronto nuevos beats.</p>}
        </div>
      </section>
    </>
  );
}
