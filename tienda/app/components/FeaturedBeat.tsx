'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Beat } from '@/lib/types';
import { formatCOP, formatTime, publicUrl } from '@/lib/format';
import { usePlayer } from '../providers/PlayerProvider';
import { useCart } from '../providers/CartProvider';
import { CartIcon, CheckIcon, PlayIcon, PauseIcon } from './Icons';
import AudioWaveform from './AudioWaveform';

export default function FeaturedBeat({ beat }: { beat: Beat }) {
  const { track, isPlaying, progress, toggle, seekToPercent, getSpectrumSnapshot } = usePlayer();
  const { addItem, removeItem, isInCart } = useCart();
  const [duration, setDuration] = useState<string>('');

  const coverUrl = publicUrl('beats-covers', beat.cover_url);
  const previewUrl = publicUrl('beats-previews', beat.preview_url);
  const isActive = track?.beatId === beat.id;
  const playingThis = isActive && isPlaying;
  const isSold = beat.status === 'sold_exclusive';
  const inCart = isInCart(beat.id, 'basic');

  const meta = [
    beat.bpm ? { label: 'BPM', value: String(beat.bpm) } : null,
    duration ? { label: 'TIME', value: duration } : null,
    beat.key ? { label: 'KEY', value: beat.key } : null,
    beat.genre && beat.genre.toLowerCase() !== beat.title.toLowerCase()
      ? { label: 'STYLE', value: beat.genre }
      : null
  ].filter((item): item is { label: string; value: string } => item !== null);

  useEffect(() => {
    if (!previewUrl) {
      setDuration('');
      return;
    }

    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = previewUrl;
    const onLoaded = () => setDuration(formatTime(probe.duration));
    probe.addEventListener('loadedmetadata', onLoaded);
    return () => probe.removeEventListener('loadedmetadata', onLoaded);
  }, [previewUrl]);

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
          {!!meta.length && (
            <div className="featured-meta">
              {meta.map((item) => (
                <span key={item.label} className="featured-meta-pill">
                  <small>{item.label}</small>
                  {item.value}
                </span>
              ))}
            </div>
          )}
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

      {previewUrl && (
        <AudioWaveform
          active={isActive}
          playing={playingThis}
          progress={isActive ? progress : 0}
          onSeek={seekToPercent}
          getSpectrumSnapshot={getSpectrumSnapshot}
        />
      )}
    </section>
  );
}
