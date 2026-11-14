import { describe, expect, it } from 'vitest';
import { renderProducerInvite } from '@/lib/producers/invite-email';
import { beatStoreUrl, DEFAULT_STORE_ORIGIN, displayUrl, producerStoreUrl, storeOrigin } from '@/lib/producers/store-url';

describe('storeOrigin', () => {
  it('usa la tienda de produccion si no hay TIENDA_URL', () => {
    expect(storeOrigin(undefined)).toBe(DEFAULT_STORE_ORIGIN);
    expect(storeOrigin('  ')).toBe(DEFAULT_STORE_ORIGIN);
  });

  it('respeta TIENDA_URL y le quita la barra final', () => {
    expect(storeOrigin('https://tienda.ejemplo.com/')).toBe('https://tienda.ejemplo.com');
  });
});

describe('direcciones de la tienda', () => {
  it('arma la de un productor y la de un beat', () => {
    expect(producerStoreUrl('helmentt', 'https://t.com')).toBe('https://t.com/productor/helmentt');
    expect(beatStoreUrl('noche-en-cali', 'https://t.com')).toBe('https://t.com/noche-en-cali');
  });

  it('codifica lo que no sea seguro en una direccion', () => {
    expect(producerStoreUrl('a/b?x', 'https://t.com')).toBe('https://t.com/productor/a%2Fb%3Fx');
  });

  it('displayUrl quita https y la barra final', () => {
    expect(displayUrl('https://tienda.lujourban.com/productor/helmentt')).toBe('tienda.lujourban.com/productor/helmentt');
    expect(displayUrl('https://tienda.lujourban.com/')).toBe('tienda.lujourban.com');
  });
});

describe('renderProducerInvite', () => {
  const link = 'https://admin.lujourban.com/auth/confirm?x=1';

  it('incluye su tienda cuando la tiene', () => {
    const html = renderProducerInvite('Helmentt', link, 'https://tienda.lujourban.com/productor/helmentt');
    expect(html).toContain('Tu tienda');
    expect(html).toContain('href="https://tienda.lujourban.com/productor/helmentt"');
    expect(html).toContain('Crear mi clave');
  });

  it('sin tienda no deja un bloque vacio', () => {
    expect(renderProducerInvite('Helmentt', link, null)).not.toContain('Tu tienda');
    expect(renderProducerInvite('Helmentt', link)).not.toContain('Tu tienda');
  });

  it('escapa el nombre y la direccion de la tienda', () => {
    const html = renderProducerInvite('<b>X</b>', link, 'https://t.com/productor/"><script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>X</b>');
  });
});
