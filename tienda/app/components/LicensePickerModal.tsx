'use client';

import { useEffect } from 'react';
import type { Beat, LicenseType } from '@/lib/types';
import { LICENSE_LABELS, priceForLicense } from '@/lib/types';
import { formatCOP } from '@/lib/format';
import { CartIcon, CheckIcon } from './Icons';

type LicensePickerModalProps = {
  beat: Beat;
  coverUrl: string;
  open: boolean;
  isInCart: (beatId: string, license: LicenseType) => boolean;
  onClose: () => void;
  onChoose: (license: LicenseType) => void;
};

const LICENSES: LicenseType[] = ['basic', 'premium', 'exclusive'];

const licenseDisplay: Record<LicenseType, { name: string; format: string; detail: string }> = {
  basic: { name: 'MP3', format: 'MP3', detail: LICENSE_LABELS.basic.desc },
  premium: { name: 'WAV', format: 'WAV + MP3', detail: LICENSE_LABELS.premium.desc },
  exclusive: { name: 'EXCLUSIVA', format: 'WAV + MP3', detail: LICENSE_LABELS.exclusive.desc }
};

export default function LicensePickerModal({
  beat,
  coverUrl,
  open,
  isInCart,
  onClose,
  onChoose
}: LicensePickerModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="license-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="license-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Licencias para ${beat.title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="license-modal-close" onClick={onClose} aria-label="Cerrar">
          ×
        </button>

        <div className="license-modal-head">
          <div className="license-modal-cover">
            {coverUrl && <img src={coverUrl} alt={`Portada de ${beat.title}`} />}
          </div>

          <div className="license-modal-titlebox">
            <span className="license-modal-kicker">Elige tu licencia</span>
            <h2>{beat.title}</h2>
            <div className="license-modal-meta">
              {beat.genre && <span>{beat.genre}</span>}
              {beat.bpm && <span>{beat.bpm} BPM</span>}
              {beat.key && <span>{beat.key}</span>}
            </div>
            {beat.tags && beat.tags.length > 0 && (
              <div className="license-modal-tags">
                {beat.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
          </div>
        </div>

        <div className="license-modal-grid">
          {LICENSES.map((license) => {
            const display = licenseDisplay[license];
            const inCart = isInCart(beat.id, license);
            return (
              <button
                key={license}
                type="button"
                className={`license-card ${inCart ? 'in-cart' : ''} ${license === 'exclusive' ? 'exclusive' : ''}`}
                onClick={() => onChoose(license)}
              >
                <span className="license-card-name">{display.name}</span>
                <strong>{formatCOP(priceForLicense(beat, license))}</strong>
                <small>{display.format}</small>
                <span className="license-card-detail">{display.detail}</span>
                <span className="license-card-action">
                  {inCart ? <CheckIcon /> : <CartIcon />}
                  {inCart ? 'En carrito' : 'Agregar'}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
