'use client';

import { usePlayer } from '../providers/PlayerProvider';
import { useCart } from '../providers/CartProvider';
import { formatCOP } from '@/lib/format';
import {
  CartIcon,
  CheckIcon,
  ListIcon,
  NextTrackIcon,
  PrevTrackIcon,
  RepeatIcon,
  ShareIcon,
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
    cycleRepeat
  } = usePlayer();
  const { addItem, removeItem, isInCart, openCart } = useCart();

  if (!track) return null;

  const inCart = isInCart(track.beatId, 'basic');

  const toggleCart = () => {
    if (inCart) {
      removeItem(track.beatId, 'basic');
      return;
    }
    addItem({
      beatId: track.beatId,
      slug: track.slug,
      title: track.title,
      coverUrl: track.coverUrl,
      license: 'basic',
      price: track.price
    });
  };

  const share = () => {
    const url = `${location.origin}/${track.slug}`;
    if (navigator.share) {
      navigator.share({ title: track.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="player-bar">
      <div className="player-bar-progress">
        <div className="player-bar-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="player-bar-inner">
        <div className="player-bar-track">
          <div className={`player-bar-disc ${isPlaying ? 'spinning' : ''}`}>
            {track.coverUrl && <img src={track.coverUrl} alt={track.title} />}
          </div>
          <div className="player-bar-meta">
            <p className="player-bar-title">{track.title}</p>
            <p className="player-bar-subtitle">{track.genre || 'Lujo Urban'}</p>
          </div>
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
            {isPlaying ? '❚❚' : '▶'}
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

          <button type="button" className={`player-bar-cart ${inCart ? 'in-cart' : ''}`} onClick={toggleCart}>
            <span>{formatCOP(track.price)}</span>
            {inCart ? <CheckIcon /> : <CartIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
