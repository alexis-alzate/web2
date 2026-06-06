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
          <path d="M12 3a6 6 0 0 0-6 6v2.1c0 .5.4.9.9.9s.9-.4.9-.9V9a4.2 4.2 0 1 1 8.4 0c0 4.8-2 8-5.8 9.6-.5.2-.7.7-.5 1.2.2.5.7.7 1.2.5C15.7 18.4 18 14.5 18 9a6 6 0 0 0-6-6Zm0 3.2A2.8 2.8 0 0 0 9.2 9v2.4c0 2-.7 3.7-2.1 5.1a.9.9 0 1 0 1.3 1.3 8.5 8.5 0 0 0 2.6-6.4V9a1 1 0 1 1 2 0c0 2.6-.4 4.6-1.3 6.1a.9.9 0 1 0 1.6.9c1-1.8 1.5-4.1 1.5-7A2.8 2.8 0 0 0 12 6.2Z" />
        </svg>
        <span>{pending ? 'Verificando' : 'Entrar con huella'}</span>
      </button>
      {message ? <p className="auth-note passkey-note">{message}</p> : null}
    </div>
  );
}
