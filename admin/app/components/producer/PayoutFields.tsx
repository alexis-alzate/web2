'use client';

import { useState } from 'react';
import { PAYOUT_METHODS } from '@/lib/producers/payout-rules';
import type { PayoutDetails, PayoutMethod } from '@/lib/producers/types';

// Campos de "como quieres recibir tu pago". La ayuda cambia segun el metodo,
// pero siempre ocupa el mismo alto: nada se mueve al elegir.

type PayoutFieldsProps = {
  defaults: PayoutDetails | null;
};

export function PayoutFields({ defaults }: PayoutFieldsProps) {
  const [method, setMethod] = useState<PayoutMethod>(defaults?.method ?? 'nequi');
  const hint = PAYOUT_METHODS.find(item => item.value === method)?.hint ?? '';
  const isMobileWallet = method === 'nequi' || method === 'daviplata';

  return (
    <>
      <label>
        ¿Cómo quieres recibir tu pago?
        <select name="method" value={method} onChange={event => setMethod(event.currentTarget.value as PayoutMethod)}>
          {PAYOUT_METHODS.map(item => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </label>
      <label>
        {isMobileWallet ? 'Número de celular' : 'Número de cuenta'}
        <input
          name="account"
          type="text"
          inputMode={method === 'otro' ? 'text' : 'numeric'}
          autoComplete="off"
          maxLength={80}
          required
          defaultValue={defaults?.account ?? ''}
          aria-describedby="payout-account-hint"
        />
        <small id="payout-account-hint" className="pt-hint-fixed">{hint}</small>
      </label>
      <label>
        Nombre del titular
        <input
          name="holder"
          type="text"
          autoComplete="name"
          maxLength={80}
          required
          defaultValue={defaults?.holder ?? ''}
          placeholder="Como aparece en la cuenta"
        />
      </label>
    </>
  );
}
