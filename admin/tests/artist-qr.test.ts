import { describe, expect, it } from 'vitest';
import {
  assertQrTarget,
  createArtistQr,
  parseQrFormat,
  qrFileName,
  qrPath
} from '@/lib/artist-qr';
import { ValidationError } from '@/lib/errors';
import { PNG_SIZE_PX, QrCodeRenderer, type QrRenderer } from '@/lib/qr/renderer';

// Doble en memoria: guarda con que texto se le pidio dibujar.
const fakeRenderer = () => {
  const calls: Array<{ kind: 'svg' | 'png'; text: string }> = [];
  const renderer: QrRenderer = {
    svg: async text => {
      calls.push({ kind: 'svg', text });
      return `<svg>${text}</svg>`;
    },
    png: async text => {
      calls.push({ kind: 'png', text });
      return new Uint8Array([1, 2, 3]);
    }
  };
  return { renderer, calls };
};

describe('parseQrFormat', () => {
  it('sin formato usa PNG', () => {
    expect(parseQrFormat(null)).toBe('png');
    expect(parseQrFormat(undefined)).toBe('png');
    expect(parseQrFormat('  ')).toBe('png');
  });

  it('acepta png y svg sin importar mayúsculas ni espacios', () => {
    expect(parseQrFormat('SVG')).toBe('svg');
    expect(parseQrFormat(' png ')).toBe('png');
  });

  it('rechaza cualquier otro formato', () => {
    expect(() => parseQrFormat('gif')).toThrow(ValidationError);
    expect(() => parseQrFormat('svg;x')).toThrow(ValidationError);
  });
});

describe('assertQrTarget', () => {
  it('acepta el enlace corto y la dirección larga del sitio', () => {
    expect(assertQrTarget('https://www.lujourban.com/julian')).toBe('https://www.lujourban.com/julian');
    expect(assertQrTarget('https://www.lujourban.com/artistas/julian/')).toBe('https://www.lujourban.com/artistas/julian/');
    expect(assertQrTarget('https://lujourban.com/julian')).toBe('https://lujourban.com/julian');
  });

  it('rechaza destinos que no son del sitio', () => {
    expect(() => assertQrTarget('https://otro-sitio.com/julian')).toThrow(ValidationError);
    expect(() => assertQrTarget('https://www.lujourban.com.otro.com/julian')).toThrow(ValidationError);
    expect(() => assertQrTarget('https://admin.lujourban.com/')).toThrow(ValidationError);
  });

  it('rechaza http, otros protocolos, vacío y texto que no es una URL', () => {
    expect(() => assertQrTarget('http://www.lujourban.com/julian')).toThrow(ValidationError);
    expect(() => assertQrTarget('javascript:alert(1)')).toThrow(ValidationError);
    expect(() => assertQrTarget('')).toThrow(ValidationError);
    expect(() => assertQrTarget('no es una url')).toThrow(ValidationError);
  });

  it('rechaza direcciones demasiado largas', () => {
    expect(() => assertQrTarget(`https://www.lujourban.com/${'a'.repeat(300)}`)).toThrow(ValidationError);
  });
});

describe('qrFileName', () => {
  it('arma el nombre con el slug y la extensión', () => {
    expect(qrFileName('julian-ramos', 'png')).toBe('qr-julian-ramos.png');
    expect(qrFileName('julian-ramos', 'svg')).toBe('qr-julian-ramos.svg');
  });

  it('limpia lo que no debe ir en una cabecera HTTP', () => {
    expect(qrFileName('Ju"li\r\nan/..', 'png')).toBe('qr-ju-li-an.png');
    expect(qrFileName('///', 'svg')).toBe('qr-artista.svg');
  });
});

describe('qrPath', () => {
  it('apunta a la ruta del QR, con y sin descarga', () => {
    expect(qrPath('svg')).toBe('/api/portal/qr?formato=svg');
    expect(qrPath('png', true)).toBe('/api/portal/qr?formato=png&descargar=1');
  });
});

describe('createArtistQr', () => {
  it('pide el SVG al dibujante con la dirección del artista', async () => {
    const { renderer, calls } = fakeRenderer();
    const qr = await createArtistQr(
      { slug: 'julian', url: 'https://www.lujourban.com/julian', format: 'svg' },
      renderer
    );

    expect(calls).toEqual([{ kind: 'svg', text: 'https://www.lujourban.com/julian' }]);
    expect(qr.fileName).toBe('qr-julian.svg');
    expect(qr.contentType).toBe('image/svg+xml; charset=utf-8');
    expect(qr.body).toBe('<svg>https://www.lujourban.com/julian</svg>');
  });

  it('pide el PNG cuando el formato es png', async () => {
    const { renderer, calls } = fakeRenderer();
    const qr = await createArtistQr(
      { slug: 'julian', url: 'https://www.lujourban.com/julian', format: 'png' },
      renderer
    );

    expect(calls.map(call => call.kind)).toEqual(['png']);
    expect(qr.contentType).toBe('image/png');
    expect(qr.fileName).toBe('qr-julian.png');
  });

  it('no dibuja nada si el destino no es del sitio', async () => {
    const { renderer, calls } = fakeRenderer();
    await expect(
      createArtistQr({ slug: 'julian', url: 'https://otro-sitio.com/x', format: 'png' }, renderer)
    ).rejects.toThrow(ValidationError);
    expect(calls).toEqual([]);
  });
});

// Con la librería real: comprueba que lo que sale es una imagen válida.
describe('QrCodeRenderer', () => {
  const renderer = new QrCodeRenderer();
  const url = 'https://www.lujourban.com/julian';

  it('genera un SVG escalable con fondo blanco y módulos oscuros', async () => {
    const svg = await renderer.svg(url);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('#ffffff');
    expect(svg).toContain('#0a0a0a');
  });

  it('genera un PNG válido del tamaño acordado', async () => {
    const png = await renderer.png(url);
    const signature = Array.from(png.slice(0, 8));
    expect(signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(PNG_SIZE_PX);
    expect(view.getUint32(20)).toBe(PNG_SIZE_PX);
  });

  it('dos direcciones distintas dan códigos distintos', async () => {
    const a = await renderer.svg(url);
    const b = await renderer.svg('https://www.lujourban.com/otro');
    expect(a).not.toBe(b);
  });
});
