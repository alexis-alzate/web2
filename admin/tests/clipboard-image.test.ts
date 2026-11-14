import { describe, expect, it, vi } from 'vitest';
import { copyImageToClipboard, fetchPngBlob, type ClipboardEnv } from '@/lib/clipboard-image';

const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });

// Navegador falso: guarda lo que se le pidio copiar.
const fakeEnv = (options: { writeFails?: boolean } = {}) => {
  const written: unknown[][] = [];
  const items: Array<Record<string, Promise<Blob>>> = [];

  class FakeClipboardItem {
    constructor(readonly data: Record<string, Promise<Blob>>) {
      items.push(data);
    }
  }

  const env: ClipboardEnv = {
    clipboard: {
      write: async list => {
        if (options.writeFails) throw new Error('NotAllowedError');
        written.push(list);
      }
    },
    ClipboardItem: FakeClipboardItem
  };
  return { env, written, items };
};

describe('copyImageToClipboard', () => {
  it('copia la imagen como PNG', async () => {
    const { env, written, items } = fakeEnv();
    const result = await copyImageToClipboard(async () => png(), env);

    expect(result).toBe('copied');
    expect(written).toHaveLength(1);
    expect(Object.keys(items[0])).toEqual(['image/png']);
    expect((await items[0]['image/png']).type).toBe('image/png');
  });

  it('crea el item antes de que termine la descarga (Safari)', async () => {
    const { env, items } = fakeEnv();
    let release: (blob: Blob) => void = () => undefined;
    const pending = new Promise<Blob>(resolve => { release = resolve; });

    const copying = copyImageToClipboard(() => pending, env);
    expect(items).toHaveLength(1);

    release(png());
    expect(await copying).toBe('copied');
  });

  it('avisa cuando el navegador no sabe copiar imágenes', async () => {
    expect(await copyImageToClipboard(async () => png(), {})).toBe('unsupported');
    expect(await copyImageToClipboard(async () => png(), { clipboard: { write: async () => undefined } })).toBe('unsupported');
  });

  it('devuelve failed si el navegador rechaza la copia', async () => {
    const { env } = fakeEnv({ writeFails: true });
    expect(await copyImageToClipboard(async () => png(), env)).toBe('failed');
  });

  it('devuelve failed si la imagen no se pudo bajar', async () => {
    const { env } = fakeEnv();
    const failing = () => Promise.reject(new Error('sin red'));
    const rejectedWrite: ClipboardEnv = {
      ...env,
      clipboard: { write: async list => { await (list[0] as { data: Record<string, Promise<Blob>> }).data['image/png']; } }
    };
    expect(await copyImageToClipboard(failing, rejectedWrite)).toBe('failed');
  });
});

describe('fetchPngBlob', () => {
  it('devuelve la imagen cuando la respuesta es un PNG', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(png(), { status: 200, headers: { 'Content-Type': 'image/png' } })));
    const blob = await fetchPngBlob('/api/portal/qr?formato=png');
    expect(blob.type).toBe('image/png');
  });

  it('falla si la respuesta no es correcta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 403 })));
    await expect(fetchPngBlob('/api/portal/qr?formato=png')).rejects.toThrow('403');
  });

  it('falla si lo que llega no es un PNG', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } })));
    await expect(fetchPngBlob('/api/portal/qr?formato=png')).rejects.toThrow('PNG');
  });
});
