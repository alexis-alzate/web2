// Direcciones publicas de la tienda de un productor y de sus beats. Puras: el
// origen se recibe por parametro (y `storeOrigin` lo lee de TIENDA_URL con el
// mismo valor por defecto que usa lib/email.ts).

export const DEFAULT_STORE_ORIGIN = 'https://tienda.lujourban.com';

export const storeOrigin = (configured: string | undefined = process.env.TIENDA_URL) =>
  (configured?.trim() || DEFAULT_STORE_ORIGIN).replace(/\/+$/, '');

// tienda.lujourban.com/productor/<slug>
export const producerStoreUrl = (slug: string, origin: string = storeOrigin()) =>
  `${origin}/productor/${encodeURIComponent(slug)}`;

// tienda.lujourban.com/<slug-del-beat>
export const beatStoreUrl = (beatSlug: string, origin: string = storeOrigin()) =>
  `${origin}/${encodeURIComponent(beatSlug)}`;

// "tienda.lujourban.com/productor/helmentt" para mostrar en pantalla.
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
