'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Beat } from '@/lib/types';
import { publicUrl } from '@/lib/format';
import { usePlayer } from '../providers/PlayerProvider';
import BeatRow from './BeatRow';
import FeaturedBeat from './FeaturedBeat';
import { MailIcon, TagIcon, ShieldCheckIcon } from './Icons';

export default function BeatCatalog({ beats }: { beats: Beat[] }) {
  const [activeGenre, setActiveGenre] = useState('all');
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
          price: b.price_basic,
          pricePremium: b.price_premium,
          priceExclusive: b.price_exclusive,
          bpm: b.bpm,
          key: b.key
        }))
    );
  }, [filtered, setQueue]);

  return (
    <section className="tienda-section">
      <div className="tienda-trust" aria-label="Garantías de compra">
        <div className="tienda-trust-item">
          <span className="tienda-trust-icon"><MailIcon /></span>
          <span className="tienda-trust-text">Entrega inmediata por correo</span>
        </div>
        <div className="tienda-trust-item">
          <span className="tienda-trust-icon"><TagIcon /></span>
          <span className="tienda-trust-text">Licencias básica, premium y exclusiva</span>
        </div>
        <div className="tienda-trust-item">
          <span className="tienda-trust-icon"><ShieldCheckIcon /></span>
          <span className="tienda-trust-text">Pago 100% seguro con MercadoPago</span>
        </div>
      </div>

      {beats.length > 0 && <FeaturedBeat beat={beats[0]} />}

      {!!genres.length && (
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

      <div className="beats-table-head" aria-hidden="true">
        <span />
        <span>Title</span>
        <span>Time</span>
        <span>BPM</span>
        <span>Tags</span>
        <span />
        <span>Price</span>
      </div>

      <div className="beats-list">
        {filtered.length
          ? filtered.map((beat) => <BeatRow key={beat.id} beat={beat} />)
          : <p className="beats-loading">Pronto nuevos beats.</p>}
      </div>
    </section>
  );
}
