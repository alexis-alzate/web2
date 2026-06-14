'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Beat, LicenseType } from '@/lib/types';
import { priceForLicense } from '@/lib/types';
import { formatCOP, formatTime, publicUrl } from '@/lib/format';
import { usePlayer } from '../providers/PlayerProvider';
import { useCart } from '../providers/CartProvider';
import { CartIcon, CheckIcon, PlayIcon, PauseIcon, ShareIcon } from './Icons';
import AudioWaveform from './AudioWaveform';
import LicensePickerModal from './LicensePickerModal';

export default function BeatRow({ beat }: { beat: Beat }) {
  const { track, isPlaying, progress, toggle, seekToPercent, getSpectrumSnapshot } = usePlayer();
  const { items, addItem, isInCart } = useCart();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState<string>('');
  const [shouldLoadDuration, setShouldLoadDuration] = useState(false);
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const coverUrl = publicUrl('beats-covers', beat.cover_url);
  const previewUrl = publicUrl('beats-previews', beat.preview_url);
  const isActive = track?.beatId === beat.id;
  const playingThis = isActive && isPlaying;
  const isSold = beat.status === 'sold_exclusive';

  useEffect(() => {
    if (!previewUrl) {
      setShouldLoadDuration(false);
      return;
    }

    const node = rowRef.current;
    if (!node || !('IntersectionObserver' in window)) {
      setShouldLoadDuration(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoadDuration(true);
          observer.disconnect();
        }
      },
      { rootMargin: '280px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [previewUrl]);

  useEffect(() => {
    if (!previewUrl || !shouldLoadDuration) return;
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = previewUrl;
    const onLoaded = () => setDuration(formatTime(probe.duration));
    probe.addEventListener('loadedmetadata', onLoaded);
    return () => probe.removeEventListener('loadedmetadata', onLoaded);
  }, [previewUrl, shouldLoadDuration]);

  const share = () => {
    const url = `${location.origin}/${beat.slug}`;
    if (navigator.share) {
      navigator.share({ title: beat.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const inCart = items.some((item) => item.beatId === beat.id);

  const chooseLicense = (license: LicenseType) => {
    addItem({
      beatId: beat.id,
      slug: beat.slug,
      title: beat.title,
      coverUrl,
      license,
      price: priceForLicense(beat, license)
    });
    setLicenseModalOpen(false);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 620);
  };

  const metaParts = [
    beat.genre && beat.genre.toLowerCase() !== beat.title.toLowerCase() ? beat.genre : null,
    beat.bpm ? `${beat.bpm} BPM` : null,
    duration || null
  ].filter(Boolean);

  return (
    <div ref={rowRef} className={`beat-row ${isActive ? 'active' : ''}`}>
      <div className={`beat-row-cover ${playingThis ? 'spinning' : ''}`}>
        {coverUrl && <img src={coverUrl} alt={`Portada de ${beat.title}`} loading="lazy" />}
        {previewUrl && (
          <button
            type="button"
            className={`beat-row-play ${playingThis ? 'playing' : ''}`}
            aria-label={playingThis ? 'Pausar preview' : 'Reproducir preview'}
            onClick={() => toggle({ beatId: beat.id, slug: beat.slug, title: beat.title, genre: beat.genre, coverUrl, previewUrl, price: beat.price_basic, pricePremium: beat.price_premium, priceExclusive: beat.price_exclusive, bpm: beat.bpm, key: beat.key, producer: beat.producer })}
          >
            {playingThis ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
      </div>

      <div className="beat-row-titlebox">
        <Link href={`/${beat.slug}`} className="beat-row-title">{beat.title}</Link>
        {!!metaParts.length && (
          <span className="beat-row-meta">{metaParts.join(' · ')}</span>
        )}
        {beat.producer && (
          <span className="beat-row-producer">
            <span className="beat-row-producer-label">Prod.</span> {beat.producer}
          </span>
        )}
        {beat.key && <span className="beat-row-key">{beat.key}</span>}
        {previewUrl && (
          <AudioWaveform
            compact
            active={isActive}
            playing={playingThis}
            progress={isActive ? progress : 0}
            onSeek={isActive ? seekToPercent : () => {}}
            getSpectrumSnapshot={getSpectrumSnapshot}
          />
        )}
      </div>

      <span className="beat-row-time">{duration || '--:--'}</span>
      <span className="beat-row-bpm">{beat.bpm || '—'}</span>

      <span className="beat-row-tags">
        {beat.tags && beat.tags.length ? beat.tags.slice(0, 3).join(' · ') : ''}
      </span>

      <button type="button" className="beat-row-share" onClick={share} aria-label="Compartir">
        <ShareIcon />
      </button>

      {isSold ? (
        <span className="beat-row-sold">Exclusiva vendida</span>
      ) : (
        <div className="beat-row-buy">
          <span className="beat-row-price">
            <small>desde</small>
            {formatCOP(beat.price_basic)}
          </span>
          <button
            type="button"
            className={`beat-row-btn ${inCart ? 'in-cart' : ''} ${justAdded ? 'just-added' : ''}`}
            onClick={() => setLicenseModalOpen(true)}
          >
            <span className="beat-row-btn-icon">{inCart ? <CheckIcon /> : <CartIcon />}</span>
            {inCart ? 'VER' : 'ADD'}
          </button>
        </div>
      )}

      <LicensePickerModal
        beat={beat}
        coverUrl={coverUrl}
        open={licenseModalOpen}
        isInCart={isInCart}
        onClose={() => setLicenseModalOpen(false)}
        onChoose={chooseLicense}
      />
    </div>
  );
}
