'use client';

import { useRef, useState } from 'react';
import { usePlayer } from '../providers/PlayerProvider';
import { useCart } from '../providers/CartProvider';
import { formatCOP } from '@/lib/format';
import type { Beat, LicenseType } from '@/lib/types';
import { priceForLicense } from '@/lib/types';
import LicensePickerModal from './LicensePickerModal';
import {
  CartIcon,
  CheckIcon,
  ListIcon,
  NextTrackIcon,
  PauseIcon,
  PlayIcon,
  PrevTrackIcon,
  RepeatIcon,
  ShareIcon,
  SpectrumModeIcon,
  VolumeIcon
} from './Icons';

export default function PlayerBar() {
  const {
    track,
    isPlaying,
    progress,
    volume,
    muted,
    repeat,
    hasNext,
    hasPrev,
    togglePlayPause,
    playNext,
    playPrevious,
    setVolume,
    toggleMute,
    cycleRepeat,
    seekToPercent,
    spectrumMode,
    toggleSpectrumMode
  } = usePlayer();
  const { items, addItem, isInCart, openCart } = useCart();
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const progressRef = useRef<HTMLDivElement | null>(null);

  if (!track) return null;

  const inCart = items.some((item) => item.beatId === track.beatId);
  const playerBeat: Beat = {
    id: track.beatId,
    slug: track.slug,
    title: track.title,
    bpm: track.bpm ?? null,
    key: track.key ?? null,
    genre: track.genre,
    producer: track.producer ?? null,
    tags: null,
    cover_url: null,
    preview_url: null,
    price_basic: track.price,
    price_premium: track.pricePremium ?? track.price,
    price_exclusive: track.priceExclusive ?? track.price,
    file_basic_path: null,
    file_premium_path: null,
    file_exclusive_path: null,
    status: 'available',
    created_at: ''
  };

  const chooseLicense = (license: LicenseType) => {
    addItem({
      beatId: track.beatId,
      slug: track.slug,
      title: track.title,
      coverUrl: track.coverUrl,
      license,
      price: priceForLicense(playerBeat, license)
    });
    setLicenseModalOpen(false);
  };

  const share = () => {
    const url = `${location.origin}/${track.slug}`;
    if (navigator.share) {
      navigator.share({ title: track.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const seekFromPointer = (clientX: number) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return;
    seekToPercent(((clientX - rect.left) / rect.width) * 100);
  };

  const subtitle = [
    track.producer ? `Prod. ${track.producer}` : (track.genre || 'Lujo Urban'),
    track.bpm ? `${track.bpm} BPM` : null,
    track.key || null
  ].filter(Boolean).join(' · ');

  return (
    <div className="player-bar">
      <div
        ref={progressRef}
        className="player-bar-progress"
        onClick={(event) => seekFromPointer(event.clientX)}
        role="slider"
        aria-label="Progreso del preview"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div className="player-bar-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="player-bar-inner">
        <div className="player-bar-track">
          <div className={`player-bar-disc ${isPlaying ? 'spinning' : ''}`}>
            {track.coverUrl && <img src={track.coverUrl} alt={track.title} />}
          </div>
          <div className="player-bar-meta">
            <p className="player-bar-title">{track.title}</p>
            <p className="player-bar-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="player-bar-icon-btn player-bar-spectrum-btn"
            onClick={toggleSpectrumMode}
            aria-label={spectrumMode === 'curve' ? 'Cambiar a barras' : 'Cambiar a curva'}
            title={spectrumMode === 'curve' ? 'Espectro: curva' : 'Espectro: barras'}
          >
            <SpectrumModeIcon mode={spectrumMode} />
          </button>
          <button type="button" className="player-bar-icon-btn" onClick={share} aria-label="Compartir">
            <ShareIcon />
          </button>
        </div>

        <div className="player-bar-controls">
          <button
            type="button"
            className={`player-bar-icon-btn ${repeat !== 'off' ? 'active' : ''}`}
            onClick={cycleRepeat}
            aria-label="Repetir"
          >
            <RepeatIcon mode={repeat} />
          </button>
          <button
            type="button"
            className="player-bar-icon-btn"
            onClick={playPrevious}
            disabled={!hasPrev}
            aria-label="Beat anterior"
          >
            <PrevTrackIcon />
          </button>
          <button
            type="button"
            className={`player-bar-toggle ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlayPause}
            aria-label="Reproducir/Pausar"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            className="player-bar-icon-btn"
            onClick={playNext}
            disabled={!hasNext}
            aria-label="Siguiente beat"
          >
            <NextTrackIcon />
          </button>
          <button type="button" className="player-bar-icon-btn" onClick={openCart} aria-label="Ver carrito">
            <ListIcon />
          </button>
        </div>

        <div className="player-bar-side">
          <div className="player-bar-volume">
            <button type="button" className="player-bar-icon-btn" onClick={toggleMute} aria-label="Silenciar">
              <VolumeIcon muted={muted || volume === 0} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="player-bar-volume-slider"
              aria-label="Volumen"
            />
          </div>

          <button type="button" className={`player-bar-cart ${inCart ? 'in-cart' : ''}`} onClick={() => setLicenseModalOpen(true)}>
            <span>{formatCOP(track.price)}</span>
            {inCart ? <CheckIcon /> : <CartIcon />}
          </button>
        </div>
      </div>
      <LicensePickerModal
        beat={playerBeat}
        coverUrl={track.coverUrl}
        open={licenseModalOpen}
        isInCart={isInCart}
        onClose={() => setLicenseModalOpen(false)}
        onChoose={chooseLicense}
      />
    </div>
  );
}
