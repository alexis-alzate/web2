'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const supportsPasskeys = async () => {
  if (!window.PublicKeyCredential) return false;
  if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return true;
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
};

export function PasskeyLoginButton() {
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supportsPasskeys().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  const signIn = async () => {
    setPending(true);
    setMessage('');

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        setMessage('Primero registra la huella/passkey desde el panel.');
        return;
      }

      window.location.assign('/');
    } catch {
      setMessage('No pude abrir la huella en este dispositivo.');
    } finally {
      setPending(false);
    }
  };

  if (!available) return null;

  return (
    <div className="passkey-area">
      <button type="button" className="passkey-button" onClick={signIn} disabled={pending}>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 2.75A6.25 6.25 0 0 0 5.75 9v2.35a.85.85 0 1 0 1.7 0V9a4.55 4.55 0 1 1 9.1 0c0 4.75-1.95 7.95-5.8 9.52a.85.85 0 1 0 .64 1.58c4.53-1.84 6.86-5.58 6.86-11.1A6.25 6.25 0 0 0 12 2.75Zm0 3.12A3.13 3.13 0 0 0 8.87 9v2.62c0 2.13-.72 3.87-2.16 5.25a.85.85 0 1 0 1.18 1.23 8.74 8.74 0 0 0 2.68-6.48V9a1.43 1.43 0 0 1 2.86 0c0 2.8-.5 5.05-1.49 6.72a.85.85 0 1 0 1.46.87c1.15-1.94 1.73-4.48 1.73-7.59A3.13 3.13 0 0 0 12 5.87Zm0 3.12a.85.85 0 0 0-.85.85v1.78c0 3.47-1.4 6.05-4.2 7.74a.85.85 0 1 0 .88 1.46c3.32-2 5.02-5.1 5.02-9.2V9.84A.85.85 0 0 0 12 8.99Z" />
        </svg>
        <span className="sr-only">{pending ? 'Verificando' : 'Entrar con huella'}</span>
      </button>
      <span className="passkey-label">{pending ? 'Verificando' : 'Huella'}</span>
      {message ? <p className="auth-note passkey-note">{message}</p> : null}
    </div>
  );
}
