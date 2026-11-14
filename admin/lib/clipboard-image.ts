// Copiar una imagen al portapapeles del navegador (para pegarla en WhatsApp,
// Instagram, etc.). Logica sin React: el navegador llega por parametro, asi
// se prueba con dobles en memoria. El boton que la usa es
// components/portal/QrCopyButton.tsx.

export type ClipboardEnv = {
  clipboard?: { write(items: unknown[]): Promise<void> };
  ClipboardItem?: new (items: Record<string, Promise<Blob>>) => unknown;
};

export type CopyImageResult = 'copied' | 'unsupported' | 'failed';

// Baja una imagen PNG de nuestro propio sitio. Falla si la respuesta no es una
// imagen: nunca se copia al portapapeles algo que no se pueda pegar.
export const fetchPngBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error(`No se pudo bajar la imagen (${response.status}).`);
  const blob = await response.blob();
  if (blob.type !== 'image/png') throw new Error('La respuesta no es una imagen PNG.');
  return blob;
};

export const copyImageToClipboard = async (
  loadImage: () => Promise<Blob>,
  env: ClipboardEnv
): Promise<CopyImageResult> => {
  if (!env.clipboard?.write || !env.ClipboardItem) return 'unsupported';

  try {
    // Se entrega la PROMESA de la imagen, no la imagen: Safari solo deja
    // copiar si el item se crea dentro del toque del usuario, antes de que
    // termine la descarga.
    const item = new env.ClipboardItem({ 'image/png': loadImage() });
    await env.clipboard.write([item]);
    return 'copied';
  } catch {
    return 'failed';
  }
};
