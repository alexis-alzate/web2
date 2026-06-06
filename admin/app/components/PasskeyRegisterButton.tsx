'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const supportsPasskeys = async () => {
  if (!window.PublicKeyCredential) return false;
  if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return true;
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
};

export function PasskeyRegisterButton() {
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supportsPasskeys().then(setAvailable).catch(() => setAvailable(false));
  }, []);

  const register = async () => {
    setPending(true);
    setMessage('');

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.registerPasskey();
      if (error) {
        setMessage('No pude registrar la huella. Revisa que Passkeys este activo en Supabase.');
        return;
      }

      setMessage('Huella/passkey registrada en este dispositivo.');
    } catch {
      setMessage('El navegador cancelo o no permitio registrar la huella.');
    } finally {
      setPending(false);
    }
  };

  if (!available) {
    return <p className="muted">Este navegador no reporta soporte de huella/passkey.</p>;
  }

  return (
    <div className="passkey-settings">
      <button type="button" className="button passkey-setup" onClick={register} disabled={pending}>
        {pending ? 'Registrando...' : 'Activar huella en este dispositivo'}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
