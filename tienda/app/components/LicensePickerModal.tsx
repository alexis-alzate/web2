'use client';

import { useEffect, useState } from 'react';
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
  exclusive: { name: 'ILIMITADA', format: 'MP3, WAV & STEMS', detail: LICENSE_LABELS.exclusive.desc }
};

export default function LicensePickerModal({
  beat,
  coverUrl,
  open,
  isInCart,
  onClose,
  onChoose
}: LicensePickerModalProps) {
  const [offerOpen, setOfferOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSent, setOfferSent] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  const sendOffer = async () => {
    if (!fullName.trim() || !email.includes('@') || !amount.trim()) {
      setOfferError('Completa nombre, correo y monto de oferta.');
      return;
    }

    setSendingOffer(true);
    setOfferError(null);

    try {
      const response = await fetch('/api/beat-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beat_id: beat.id,
          beat_title: beat.title,
          beat_slug: beat.slug,
          full_name: fullName,
          email,
          amount,
          message
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'No se pudo enviar la oferta.');
      setOfferSent(true);
    } catch (error) {
      console.error(error);
      setOfferError('No se pudo enviar la oferta. Intenta de nuevo.');
    } finally {
      setSendingOffer(false);
    }
  };

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

        {!offerOpen && (
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
            <button
              type="button"
              className="license-card offer"
              onClick={() => setOfferOpen(true)}
            >
              <span className="license-card-name">EXCLUSIVA</span>
              <strong>~</strong>
              <small>Make an offer</small>
              <span className="license-card-detail">Negocia una licencia exclusiva personalizada</span>
              <span className="license-card-action">Enviar oferta</span>
            </button>
          </div>
        )}

        {offerOpen && (
          <div className="offer-form-panel">
            <div className="offer-form-head">
              <div>
                <span className="license-modal-kicker">Make an offer</span>
                <h3>{beat.title}</h3>
              </div>
              <button type="button" className="offer-back-btn" onClick={() => setOfferOpen(false)}>
                Volver
              </button>
            </div>

            {offerSent ? (
              <div className="offer-success">
                <strong>Oferta enviada</strong>
                <p>Recibimos tu propuesta. Te responderemos al correo que dejaste.</p>
              </div>
            ) : (
              <div className="offer-form-grid">
                <label>
                  Nombre completo
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
                </label>
                <label>
                  E-mail
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label>
                  Monto de oferta
                  <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ej: $500.000 COP" />
                </label>
                <label className="offer-message-field">
                  Mensaje
                  <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
                </label>
                <button type="button" className="offer-submit-btn" onClick={sendOffer} disabled={sendingOffer}>
                  {sendingOffer ? 'Enviando...' : 'Send Offer'}
                </button>
                {offerError && <p className="offer-error">{offerError}</p>}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
