'use client';

import { useState } from 'react';

// Descripcion corta del productor: una caja de alto fijo y un contador que
// siempre ocupa su linea (no empuja nada al escribir). El limite coincide con el
// de la base y con el que valida el servidor (BIO_MAX_LENGTH).

const BIO_MAX_LENGTH = 160;

type BioFieldProps = {
  defaultValue: string;
};

export function BioField({ defaultValue }: BioFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const length = Array.from(value).length;
  const remaining = BIO_MAX_LENGTH - length;

  return (
    <label className="pt-bio">
      Descripción
      <textarea
        name="bio"
        rows={3}
        value={value}
        onChange={event => setValue(event.currentTarget.value.replace(/[\r\n]+/g, ' '))}
        placeholder="Productor de trap y drill. Graves pesados y melodías oscuras."
        aria-describedby="bio-count"
      />
      <small id="bio-count" className={remaining < 0 ? 'is-over' : undefined}>
        {remaining >= 0 ? `Te quedan ${remaining} caracteres.` : `Te pasaste por ${-remaining} caracteres.`}
      </small>
    </label>
  );
}
