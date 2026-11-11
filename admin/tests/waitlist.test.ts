import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/lib/errors';
import { normalizeInstagram, normalizeWhatsapp, parseWaitlistRequest } from '@/lib/waitlist';

const valid = {
  stage_name: 'El Siervo Jhon',
  whatsapp: '300 123 4567',
  instagram: '@siervo.jhon',
  followers_range: '1k_10k'
};

describe('normalizeWhatsapp', () => {
  it('agrega el indicativo 57 a un celular colombiano de 10 digitos', () => {
    expect(normalizeWhatsapp('300 123 4567')).toBe('573001234567');
    expect(normalizeWhatsapp('300-123-4567')).toBe('573001234567');
  });

  it('respeta un numero que ya trae indicativo', () => {
    expect(normalizeWhatsapp('+57 300 123 4567')).toBe('573001234567');
    expect(normalizeWhatsapp('0057 3001234567')).toBe('573001234567');
    expect(normalizeWhatsapp('+1 (305) 555-0100')).toBe('13055550100');
  });

  it('devuelve vacio si no llega texto', () => {
    expect(normalizeWhatsapp(undefined)).toBe('');
    expect(normalizeWhatsapp(3001234567)).toBe('');
  });
});

describe('normalizeInstagram', () => {
  it('acepta usuario, @usuario o la URL del perfil', () => {
    expect(normalizeInstagram('siervo.jhon')).toBe('siervo.jhon');
    expect(normalizeInstagram('@siervo.jhon')).toBe('siervo.jhon');
    expect(normalizeInstagram('https://www.instagram.com/siervo.jhon/?hl=es')).toBe('siervo.jhon');
    expect(normalizeInstagram('instagram.com/siervo.jhon')).toBe('siervo.jhon');
  });
});

describe('parseWaitlistRequest', () => {
  it('normaliza una solicitud valida', () => {
    expect(parseWaitlistRequest(valid)).toEqual({
      stage_name: 'El Siervo Jhon',
      whatsapp: '573001234567',
      instagram: 'siervo.jhon',
      followers_range: '1k_10k'
    });
  });

  it('recorta espacios y descarta campos que no espera', () => {
    const parsed = parseWaitlistRequest({
      ...valid,
      stage_name: '   La   Libreta  ',
      status: 'approved',
      id: 'x'
    });

    expect(parsed.stage_name).toBe('La Libreta');
    expect(Object.keys(parsed).sort()).toEqual(['followers_range', 'instagram', 'stage_name', 'whatsapp']);
  });

  it('corta un nombre artistico demasiado largo', () => {
    expect(parseWaitlistRequest({ ...valid, stage_name: 'a'.repeat(300) }).stage_name).toHaveLength(80);
  });

  it.each([
    ['nombre vacio', { ...valid, stage_name: ' ' }],
    ['nombre que no es texto', { ...valid, stage_name: { a: 1 } }],
    ['whatsapp corto', { ...valid, whatsapp: '12345' }],
    ['whatsapp de 10 digitos que no es celular colombiano', { ...valid, whatsapp: '6021234567' }],
    ['whatsapp demasiado largo', { ...valid, whatsapp: '1'.repeat(16) }],
    ['instagram con espacios', { ...valid, instagram: 'siervo jhon' }],
    ['instagram con HTML', { ...valid, instagram: '<script>alert(1)</script>' }],
    ['instagram vacio', { ...valid, instagram: '@' }],
    ['rango de seguidores desconocido', { ...valid, followers_range: 'muchos' }],
    ['rango de seguidores ausente', { ...valid, followers_range: undefined }]
  ])('rechaza %s', (_caso, body) => {
    expect(() => parseWaitlistRequest(body)).toThrow(ValidationError);
  });

  it('rechaza un cuerpo que no es un objeto', () => {
    expect(() => parseWaitlistRequest(null)).toThrow(ValidationError);
    expect(() => parseWaitlistRequest('hola')).toThrow(ValidationError);
  });
});
