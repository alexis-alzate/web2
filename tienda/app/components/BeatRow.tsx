'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Beat } from '@/lib/types';
import { formatCOP, formatTime, publicUrl } from '@/lib/format';
import { usePlayer } from '../providers/PlayerProvider';
import { useCart } from '../providers/CartProvider';
import { CartIcon, CheckIcon } from './Icons';

export default function BeatRow({ beat }: { beat: Beat }) {
  const { track, isPlaying, toggle } = usePlayer();
  const { addItem, removeItem, isInCart } = useCart();
  const [duration, setDuration] = useState<string>('--:--');

  const coverUrl = publicUrl('beats-covers', beat.cover_url);
  const previewUrl = publicUrl('beats-previews', beat.preview_url);
  const tagsText = beat.tags && beat.tags.length ? beat.tags.join(' · ') : '—';
  const isActive = track?.beatId === beat.id;
  const isSold = beat.status === 'sold_exclusive';

  useEffect(() => {
    if (!previewUrl) return;
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = previewUrl;
    const onLoaded = () => setDuration(formatTime(probe.duration));
    probe.addEventListener('loadedmetadata', onLoaded);
    return () => probe.removeEventListener('loadedmetadata', onLoaded);
  }, [previewUrl]);

  const share = () => {
    const url = `${location.origin}/${beat.slug}`;
    if (navigator.share) {
      navigator.share({ title: beat.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const inCart = isInCart(beat.id, 'basic');

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
    <div className="beat-row">
      <div className={`beat-row-cover ${isActive && isPlaying ? 'spinning' : ''}`}>
        {coverUrl && <img src={coverUrl} alt={`Portada de ${beat.title}`} loading="lazy" />}
        {previewUrl && (
          <button
            type="button"
            className={`beat-row-play ${isActive && isPlaying ? 'playing' : ''}`}
            aria-label="Reproducir preview"
            onClick={() => toggle({ beatId: beat.id, slug: beat.slug, title: beat.title, genre: beat.genre, coverUrl, previewUrl, price: beat.price_basic })}
          >
            {isActive && isPlaying ? '❚❚' : '▶'}
          </button>
        )}
      </div>

      <div className="beat-row-titlebox">
        <Link href={`/${beat.slug}`} className="beat-row-title">{beat.title}</Link>
        {beat.genre && beat.genre.toLowerCase() !== beat.title.toLowerCase() && (
          <span className="beat-row-subtitle">{beat.genre}</span>
        )}
      </div>
      <span className="beat-row-time">{previewUrl ? duration : '--:--'}</span>
      <span className="beat-row-bpm">{beat.bpm || '—'}</span>
      <span className="beat-row-tags">{tagsText}</span>
      <button type="button" className="beat-row-share" onClick={share} aria-label="Compartir">⤴</button>

      {isSold ? (
        <span className="beat-row-sold">Exclusiva vendida</span>
      ) : (
        <>
          <span className="beat-row-price">{formatCOP(beat.price_basic)}</span>
          <button
            type="button"
            className={`beat-row-btn ${inCart ? 'in-cart' : ''}`}
            onClick={toggleCart}
          >
            <span className="beat-row-btn-icon">{inCart ? <CheckIcon /> : <CartIcon />}</span>
            {inCart ? 'EN CARRITO' : 'ADD'}
          </button>
        </>
      )}
    </div>
  );
}
