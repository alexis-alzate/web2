// Reglas puras de como se le paga al productor. Aqui no hay Supabase ni Next.

import { ValidationError } from '@/lib/errors';
import type { PayoutDetails, PayoutMethod } from './types';

export const PAYOUT_METHODS: ReadonlyArray<{ value: PayoutMethod; label: string; hint: string }> = [
  { value: 'nequi', label: 'Nequi', hint: 'Tu número de celular de Nequi, 10 dígitos.' },
  { value: 'daviplata', label: 'Daviplata', hint: 'Tu número de celular de Daviplata, 10 dígitos.' },
  { value: 'bancolombia', label: 'Bancolombia', hint: 'Tu número de cuenta de ahorros o corriente.' },
  { value: 'otro', label: 'Otro banco', hint: 'Banco, tipo de cuenta y número. Ejemplo: Davivienda ahorros 123456789.' }
];

export const HOLDER_MIN_LENGTH = 3;
export const HOLDER_MAX_LENGTH = 80;
export const ACCOUNT_MAX_LENGTH = 80;
export const REFERENCE_MAX_LENGTH = 120;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export const isPayoutMethod = (value: unknown): value is PayoutMethod =>
  PAYOUT_METHODS.some(method => method.value === value);

export const payoutMethodLabel = (method: PayoutMethod) =>
  PAYOUT_METHODS.find(item => item.value === method)?.label ?? method;

// Una sola linea, sin caracteres raros ni espacios de mas.
const singleLine = (raw: unknown) =>
  String(raw ?? '').replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();

const lengthOf = (value: string) => Array.from(value).length;

// Nequi y Daviplata son celulares colombianos: 10 digitos y empiezan por 3.
const MOBILE = /^3\d{9}$/;
// Cuentas bancarias: solo digitos (los guiones y espacios se quitan).
const BANK_ACCOUNT = /^\d{8,16}$/;

const parseAccount = (method: PayoutMethod, raw: unknown): string => {
  const text = singleLine(raw);

  if (method === 'nequi' || method === 'daviplata') {
    const digits = text.replace(/[\s.\-()]/g, '').replace(/^\+?57/, '');
    if (!MOBILE.test(digits)) {
      throw new ValidationError(
        `El número de ${payoutMethodLabel(method)} debe ser un celular colombiano de 10 dígitos que empieza por 3.`
      );
    }
    return digits;
  }

  if (method === 'bancolombia') {
    const digits = text.replace(/[\s.\-]/g, '');
    if (!BANK_ACCOUNT.test(digits)) {
      throw new ValidationError('El número de cuenta Bancolombia debe tener entre 8 y 16 dígitos, sin letras.');
    }
    return digits;
  }

  // 'otro': texto libre, pero con un minimo para que no quede vacio o inutil.
  const length = lengthOf(text);
  if (length < 6) {
    throw new ValidationError('Escribe el banco, el tipo de cuenta y el número.');
  }
  if (length > ACCOUNT_MAX_LENGTH) {
    throw new ValidationError(`Los datos de la cuenta pueden tener hasta ${ACCOUNT_MAX_LENGTH} caracteres.`);
  }
  return text;
};

const parseHolder = (raw: unknown): string => {
  const text = singleLine(raw);
  const length = lengthOf(text);
  if (length < HOLDER_MIN_LENGTH) {
    throw new ValidationError('Escribe el nombre del titular de la cuenta, tal como aparece en ella.');
  }
  if (length > HOLDER_MAX_LENGTH) {
    throw new ValidationError(`El nombre del titular puede tener hasta ${HOLDER_MAX_LENGTH} caracteres.`);
  }
  return text;
};

export const parsePayoutDetails = (input: {
  method: unknown;
  account: unknown;
  holder: unknown;
}): PayoutDetails => {
  if (!isPayoutMethod(input.method)) {
    throw new ValidationError('Elige cómo quieres recibir tu pago.');
  }
  return {
    method: input.method,
    account: parseAccount(input.method, input.account),
    holder: parseHolder(input.holder)
  };
};

// Referencia del pago que anota el admin: numero de comprobante, por ejemplo.
export const parseReference = (raw: unknown): string => {
  const text = singleLine(raw);
  if (!text) {
    throw new ValidationError('Escribe la referencia del pago (por ejemplo, el número del comprobante).');
  }
  if (lengthOf(text) > REFERENCE_MAX_LENGTH) {
    throw new ValidationError(`La referencia puede tener hasta ${REFERENCE_MAX_LENGTH} caracteres.`);
  }
  return text;
};
