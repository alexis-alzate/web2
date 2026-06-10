'use client';

import { useState } from 'react';
import type { Beat, LicenseType } from '@/lib/types';
import { LICENSE_LABELS, priceForLicense } from '@/lib/types';
import { formatCOP, publicUrl } from '@/lib/format';
import { usePlayer } from '../providers/PlayerProvider';
import { useCart } from '../providers/CartProvider';
import { CartIcon, CheckIcon } from './Icons';

const LICENSES: LicenseType[] = ['basic', 'premium', 'exclusive'];

export default function BeatDetail({ beat }: { beat: Beat }) {
  const { track, isPlaying, progress, toggle } = usePlayer();
  const { addItem, removeItem, isInCart } = useCart();
  const [license, setLicense] = useState<LicenseType>('basic');

  const coverUrl = publicUrl('beats-covers', beat.cover_url);
  const previewUrl = publicUrl('beats-previews', beat.preview_url);
  const isActive = track?.beatId === beat.id;
  const isSold = beat.status === 'sold_exclusive';

  const meta = [
    beat.genre && beat.genre.toLowerCase() !== beat.title.toLowerCase() ? beat.genre : null,
    beat.bpm ? `${beat.bpm} BPM` : null,
    beat.key
  ].filter(Boolean).join(' · ');

  const inCart = isInCart(beat.id, license);

  const toggleCart = () => {
    if (inCart) {
      removeItem(beat.id, license);
      return;
    }
    addItem({
      beatId: beat.id,
      slug: beat.slug,
      title: beat.title,
      coverUrl,
      license,
      price: priceForLicense(beat, license)
    });
  };

  return (
    <section className="tienda-section beat-detail">
      <div className="beat-detail-cover">
        {coverUrl && <img src={coverUrl} alt={`Portada de ${beat.title}`} />}
        {previewUrl && (
          <button
            type="button"
            className={`beat-detail-play ${isActive && isPlaying ? 'playing' : ''}`}
            onClick={() => toggle({ beatId: beat.id, slug: beat.slug, title: beat.title, genre: beat.genre, coverUrl, previewUrl, price: beat.price_basic })}
            aria-label="Reproducir preview"
          >
            {isActive && isPlaying ? '❚❚' : '▶'}
          </button>
        )}
      </div>

      <div className="beat-detail-info">
        <h1 className="beat-detail-title">{beat.title}</h1>
        <p className="beat-detail-meta">{meta}</p>
        {beat.tags && beat.tags.length > 0 && (
          <p className="beat-detail-tags">{beat.tags.join(' · ')}</p>
        )}

        {previewUrl && (
          <div className="modal-progress">
            <div className="modal-progress-bar" style={{ width: `${isActive ? progress : 0}%` }} />
          </div>
        )}

        {isSold ? (
          <p className="beat-row-sold">Exclusiva vendida</p>
        ) : (
          <>
            <div className="license-options">
              {LICENSES.map((type) => {
                const label = LICENSE_LABELS[type];
                const price = priceForLicense(beat, type);
                return (
                  <label key={type} className="license-option">
                    <input
                      type="radio"
                      name="license"
                      value={type}
                      checked={license === type}
                      onChange={() => setLicense(type)}
                    />
                    <span className="license-option-label">
                      <span className="license-option-name">{label.name}</span>
                      <span className="license-option-desc">{label.desc}</span>
                    </span>
                    <span className="license-option-price">{formatCOP(price)}</span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              className={`beat-row-btn beat-detail-add ${inCart ? 'in-cart' : ''}`}
              onClick={toggleCart}
            >
              <span className="beat-row-btn-icon">{inCart ? <CheckIcon /> : <CartIcon />}</span>
              {inCart ? 'En el carrito' : 'Agregar al carrito'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
