'use client';

import { useId, useState } from 'react';

type PasswordFieldProps = {
  label: string;
  name: string;
  autoComplete: string;
  required?: boolean;
};

export function PasswordField({ label, name, autoComplete, required = true }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <label htmlFor={id}>
      {label}
      <span className="password-field">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible(current => !current)}
          aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'}
          aria-pressed={visible}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 5c5.1 0 8.6 4.1 9.7 5.6.4.5.4 1.3 0 1.8C20.6 13.9 17.1 18 12 18s-8.6-4.1-9.7-5.6a1.5 1.5 0 0 1 0-1.8C3.4 9.1 6.9 5 12 5Zm0 2c-4.1 0-7 3.2-8 4.5 1 1.3 3.9 4.5 8 4.5s7-3.2 8-4.5C19 10.2 16.1 7 12 7Zm0 2.2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Z" />
          </svg>
        </button>
      </span>
    </label>
  );
}
