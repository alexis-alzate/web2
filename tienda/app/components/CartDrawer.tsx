'use client';

import { useState } from 'react';
import { useCart } from '../providers/CartProvider';
import { LICENSE_LABELS } from '@/lib/types';
import { formatCOP } from '@/lib/format';

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, total, clear } = useCart();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkout = async () => {
    if (!email || !email.includes('@')) {
      setError('Ingresa un correo válido.');
      return;
    }
    if (!items.length) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_email: email,
          items: items.map((it) => ({ beat_id: it.beatId, license_type: it.license }))
        })
      });

      const data = await res.json();
      if (!res.ok || !data?.init_point) throw new Error(data?.error || 'Sin init_point');

      clear();
      window.location.href = data.init_point;
    } catch (err) {
      console.error(err);
      setError('Hubo un error al procesar tu compra. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <>
      <div className={`cart-overlay ${isOpen ? 'open' : ''}`} onClick={closeCart} />
      <aside className={`cart-drawer ${isOpen ? 'open' : ''}`}>
        <div className="cart-drawer-header">
          <h2>Tu carrito</h2>
          <button type="button" className="cart-drawer-close" onClick={closeCart} aria-label="Cerrar carrito">×</button>
        </div>

        {!items.length && <p className="cart-empty">Tu carrito está vacío.</p>}

        {!!items.length && (
          <>
            <ul className="cart-items">
              {items.map((item) => (
                <li key={`${item.beatId}-${item.license}`} className="cart-item">
                  <div className="cart-item-cover">
                    {item.coverUrl && <img src={item.coverUrl} alt={item.title} />}
                  </div>
                  <div className="cart-item-info">
                    <p className="cart-item-title">{item.title}</p>
                    <p className="cart-item-license">{LICENSE_LABELS[item.license].name}</p>
                  </div>
                  <span className="cart-item-price">{formatCOP(item.price)}</span>
                  <button
                    type="button"
                    className="cart-item-remove"
                    onClick={() => removeItem(item.beatId, item.license)}
                    aria-label="Quitar del carrito"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <div className="cart-total">
              <span>Total</span>
              <strong>{formatCOP(total)}</strong>
            </div>

            <label className="email-label" htmlFor="cartEmail">Tu correo (para enviarte la descarga)</label>
            <input
              id="cartEmail"
              type="email"
              className="email-input"
              placeholder="tucorreo@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <button type="button" className="cart-checkout-btn" onClick={checkout} disabled={loading}>
              {loading ? 'Procesando...' : 'Finalizar compra'}
            </button>
            {error && <p className="buy-error">{error}</p>}
          </>
        )}
      </aside>
    </>
  );
}
