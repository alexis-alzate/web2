import { describe, expect, it } from 'vitest';
import {
  CONFIRM_TYPES,
  confirmCopy,
  isConfirmType,
  parseConfirmRequest,
  sanitizeNext
} from '@/lib/auth-confirm';

const reader = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe('sanitizeNext', () => {
  it('deja pasar rutas internas', () => {
    expect(sanitizeNext('/reset-password')).toBe('/reset-password');
    expect(sanitizeNext('/mi-perfil?x=1')).toBe('/mi-perfil?x=1');
  });

  it('usa la raiz cuando falta', () => {
    expect(sanitizeNext(null)).toBe('/');
    expect(sanitizeNext(undefined)).toBe('/');
    expect(sanitizeNext('')).toBe('/');
  });

  it.each(['//otro.com', 'https://otro.com', 'otro', '/\\otro.com', '/a\\b'])(
    'rechaza destinos que salen del sitio: %s',
    value => {
      expect(sanitizeNext(value)).toBe('/');
    }
  );
});

describe('isConfirmType', () => {
  it('acepta solo los tipos permitidos', () => {
    for (const type of CONFIRM_TYPES) expect(isConfirmType(type)).toBe(true);
    expect(isConfirmType('magiclink')).toBe(false);
    expect(isConfirmType(null)).toBe(false);
    expect(isConfirmType(undefined)).toBe(false);
  });
});

describe('parseConfirmRequest', () => {
  it('lee una invitacion valida', () => {
    const result = parseConfirmRequest(reader({ token_hash: 'abc123', type: 'invite', next: '/reset-password' }));
    expect(result).toEqual({ tokenHash: 'abc123', type: 'invite', next: '/reset-password' });
  });

  it('recorta espacios del token y usa la raiz si no hay destino', () => {
    const result = parseConfirmRequest(reader({ token_hash: '  abc  ', type: 'recovery' }));
    expect(result).toEqual({ tokenHash: 'abc', type: 'recovery', next: '/' });
  });

  it('sanea el destino', () => {
    const result = parseConfirmRequest(reader({ token_hash: 'abc', type: 'invite', next: '//otro.com' }));
    expect(result?.next).toBe('/');
  });

  it('devuelve null sin token', () => {
    expect(parseConfirmRequest(reader({ type: 'invite' }))).toBeNull();
    expect(parseConfirmRequest(reader({ token_hash: '   ', type: 'invite' }))).toBeNull();
  });

  it('devuelve null con tipo invalido o ausente', () => {
    expect(parseConfirmRequest(reader({ token_hash: 'abc', type: 'magiclink' }))).toBeNull();
    expect(parseConfirmRequest(reader({ token_hash: 'abc' }))).toBeNull();
  });

  it('devuelve null con un token desmesurado', () => {
    expect(parseConfirmRequest(reader({ token_hash: 'a'.repeat(513), type: 'invite' }))).toBeNull();
  });
});

describe('confirmCopy', () => {
  it('invitacion y registro invitan a crear la clave', () => {
    expect(confirmCopy('invite').button).toBe('Crear mi clave');
    expect(confirmCopy('signup').button).toBe('Crear mi clave');
  });

  it('recuperacion y correo usan texto de continuar', () => {
    expect(confirmCopy('recovery').button).toBe('Continuar');
    expect(confirmCopy('email').button).toBe('Continuar');
  });
});
