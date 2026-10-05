'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

type PasswordResetSubmitButtonProps = {
  startCooldown?: boolean;
};

const COOLDOWN_SECONDS = 60;

export function PasswordResetSubmitButton({ startCooldown = false }: PasswordResetSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [secondsRemaining, setSecondsRemaining] = useState(startCooldown ? COOLDOWN_SECONDS : 0);

  useEffect(() => {
    if (secondsRemaining <= 0) return;

    const timer = window.setTimeout(() => {
      setSecondsRemaining(current => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [secondsRemaining]);

  const coolingDown = secondsRemaining > 0;
  const label = pending
    ? 'Enviando...'
    : coolingDown
      ? `Reenviar en ${secondsRemaining} s`
      : startCooldown
        ? 'Reenviar'
        : 'Enviar';

  return (
    <button
      className="primary login-submit"
      disabled={pending || coolingDown}
      aria-busy={pending}
    >
      {label}
    </button>
  );
}
