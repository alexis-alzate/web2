'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Beat, LicenseType } from '@/lib/types';
import { priceForLicense } from '@/lib/types';
import { formatCOP, formatTime, publicUrl } from '@/lib/format';
import { usePlayer } from '../providers/PlayerProvider';
import { useCart } from '../providers/CartProvider';
import { CartIcon, CheckIcon, PlayIcon, PauseIcon, SpectrumModeIcon } from './Icons';
import AudioWaveform from './AudioWaveform';
import LicensePickerModal from './LicensePickerModal';

export default function FeaturedBeat({ beat }: { beat: Beat }) {
  const { track, isPlaying, progress, toggle, togglePlayPause, seekToPercent, getSpectrumSnapshot, spectrumMode, toggleSpectrumMode } = usePlayer();
  const { items, addItem, isInCart } = useCart();
  const [duration, setDuration] = useState<string>('');
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const beatCoverUrl = publicUrl('beats-covers', beat.cover_url);
  const beatPreviewUrl = publicUrl('beats-previews', beat.preview_url);
  const displayBeatId = track?.beatId ?? beat.id;
  const displaySlug = track?.slug ?? beat.slug;
  const displayTitle = track?.title ?? beat.title;
  const displayGenre = track?.genre ?? beat.genre;
  const displayProducer = track?.producer ?? beat.producer;
  const displayBpm = track?.bpm ?? beat.bpm;
  const displayKey = track?.key ?? beat.key;
  const displayPrice = track?.price ?? beat.price_basic;
  const coverUrl = track?.coverUrl || beatCoverUrl;
  const previewUrl = track?.previewUrl || beatPreviewUrl;
  const isActive = track?.beatId === displayBeatId;
  const playingThis = isActive && isPlaying;
  const isSold = beat.status === 'sold_exclusive';
  const inCart = items.some((item) => item.beatId === displayBeatId);

  const meta = [
    displayBpm ? { label: 'BPM', value: String(displayBpm) } : null,
    duration ? { label: 'TIME', value: duration } : null,
    displayKey ? { label: 'KEY', value: displayKey } : null,
    displayGenre && displayGenre.toLowerCase() !== displayTitle.toLowerCase()
      ? { label: 'STYLE', value: displayGenre }
      : null
  ].filter((item): item is { label: string; value: string } => item !== null);

  useEffect(() => {
    if (!previewUrl) {
      setDuration('');
      return;
    }

    const probe = new Audio();
    probe.preload = 'metadata';
    probe.crossOrigin = 'anonymous';
    probe.src = previewUrl;
    const onLoaded = () => setDuration(formatTime(probe.duration));
    probe.addEventListener('loadedmetadata', onLoaded);
    return () => probe.removeEventListener('loadedmetadata', onLoaded);
  }, [previewUrl]);

  const play = () => {
    if (!previewUrl) return;
    if (track) {
      togglePlayPause();
      return;
    }

    toggle({
      beatId: beat.id,
      slug: beat.slug,
      title: beat.title,
      genre: beat.genre,
      coverUrl: beatCoverUrl,
      previewUrl: beatPreviewUrl,
      price: beat.price_basic,
      pricePremium: beat.price_premium,
      priceExclusive: beat.price_exclusive,
      bpm: beat.bpm,
      key: beat.key,
      producer: beat.producer
    });
  };

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

  return (
    <section className={`featured ${isPlaying ? 'is-live' : ''}`}>
      <div className="featured-spectrum" role="group" aria-label="Estilo del espectro">
        <button
          type="button"
          className={`featured-spectrum-btn ${spectrumMode === 'curve' ? 'active' : ''}`}
          onClick={() => spectrumMode !== 'curve' && toggleSpectrumMode()}
          aria-pressed={spectrumMode === 'curve'}
          aria-label="Espectro en curva"
          title="Curva"
        >
          <SpectrumModeIcon mode="curve" />
        </button>
        <button
          type="button"
          className={`featured-spectrum-btn ${spectrumMode === 'bars' ? 'active' : ''}`}
          onClick={() => spectrumMode !== 'bars' && toggleSpectrumMode()}
          aria-pressed={spectrumMode === 'bars'}
          aria-label="Espectro en barras"
          title="Barras"
        >
          <SpectrumModeIcon mode="bars" />
        </button>
      </div>
      <div className="featured-main">
        <div className={`featured-cover ${playingThis ? 'playing' : ''}`}>
          {coverUrl && <img key={coverUrl} src={coverUrl} alt={`Portada de ${displayTitle}`} />}
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
          <Link href={`/${displaySlug}`} className="featured-title">{displayTitle}</Link>
          {displayProducer && (
            <span className="featured-producer">Prod. by {displayProducer}</span>
          )}
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
                {formatCOP(displayPrice)}
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
          {isSold && <span className="beat-row-sold">Exclusiva vendida</span>}
        </div>
      </div>

      {previewUrl && (
        <AudioWaveform
          active={!!track}
          playing={isPlaying}
          progress={progress}
          onSeek={seekToPercent}
          getSpectrumSnapshot={getSpectrumSnapshot}
        />
      )}

      <LicensePickerModal
        beat={beat}
        coverUrl={coverUrl}
        open={licenseModalOpen}
        isInCart={isInCart}
        onClose={() => setLicenseModalOpen(false)}
        onChoose={chooseLicense}
      />
    </section>
  );
}
