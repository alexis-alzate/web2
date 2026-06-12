'use client';

import Link from 'next/link';
import type { Beat } from '@/lib/types';
import { formatCOP, publicUrl } from '@/lib/format';
import { usePlayer } from '../providers/PlayerProvider';
import { useCart } from '../providers/CartProvider';
import { CartIcon, CheckIcon, PlayIcon, PauseIcon } from './Icons';

const BAR_COUNT = 56;

// Alturas deterministas (mismo render en server y cliente, sin hydration mismatch)
const barHeight = (i: number) =>
  18 + Math.round(Math.abs(Math.sin(i * 2.7) * Math.cos(i * 0.83)) * 78);

export default function FeaturedBeat({ beat }: { beat: Beat }) {
  const { track, isPlaying, toggle } = usePlayer();
  const { addItem, removeItem, isInCart } = useCart();

  const coverUrl = publicUrl('beats-covers', beat.cover_url);
  const previewUrl = publicUrl('beats-previews', beat.preview_url);
  const isActive = track?.beatId === beat.id;
  const playingThis = isActive && isPlaying;
  const isSold = beat.status === 'sold_exclusive';
  const inCart = isInCart(beat.id, 'basic');

  const meta = [
    beat.genre && beat.genre.toLowerCase() !== beat.title.toLowerCase() ? beat.genre : null,
    beat.bpm ? `${beat.bpm} BPM` : null,
    beat.key
  ].filter(Boolean).join(' · ');

  const play = () => {
    if (!previewUrl) return;
    toggle({
      beatId: beat.id,
      slug: beat.slug,
      title: beat.title,
      genre: beat.genre,
      coverUrl,
      previewUrl,
      price: beat.price_basic
    });
  };

  const toggleCart = () => {
    if (inCart) {
      removeItem(beat.id, 'basic');
      return;
    }
    addItem({
      beatId: beat.id,
      slug: beat.slug,
      title: beat.title,
      coverUrl,
      license: 'basic',
      price: beat.price_basic
    });
  };

  return (
    <section className="featured">
      <div className="featured-main">
        <div className={`featured-cover ${playingThis ? 'playing' : ''}`}>
          {coverUrl && <img src={coverUrl} alt={`Portada de ${beat.title}`} />}
          {previewUrl && (
            <button
              type="button"
              className="featured-play"
              onClick={play}
              aria-label={playingThis ? 'Pausar preview' : 'Reproducir preview'}
            >
              {playingThis ? <PauseIcon /> : <PlayIcon />}
            </button>
          )}
        </div>

        <div className="featured-info">
          <span className="featured-eyebrow">Beat destacado</span>
          <Link href={`/${beat.slug}`} className="featured-title">{beat.title}</Link>
          {meta && <p className="featured-meta">{meta}</p>}
          {beat.tags && beat.tags.length > 0 && (
            <div className="featured-tags">
              {beat.tags.slice(0, 4).map((tag) => (
                <span key={tag} className="featured-tag">{tag}</span>
              ))}
            </div>
          )}

          {!isSold && (
            <div className="featured-actions">
              <span className="featured-price">
                <small>desde</small>
                {formatCOP(beat.price_basic)}
              </span>
              <button
                type="button"
                className={`beat-row-btn ${inCart ? 'in-cart' : ''}`}
                onClick={toggleCart}
              >
                <span className="beat-row-btn-icon">{inCart ? <CheckIcon /> : <CartIcon />}</span>
                {inCart ? 'EN CARRITO' : 'ADD'}
              </button>
            </div>
          )}
          {isSold && <span className="beat-row-sold">Exclusiva vendida</span>}
        </div>
      </div>

      <div className={`wave-bars ${playingThis ? 'playing' : ''}`} aria-hidden="true">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            style={{ height: `${barHeight(i)}%`, animationDelay: `${(i % 9) * 0.11}s` }}
          />
        ))}
      </div>
    </section>
  );
}
