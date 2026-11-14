// Dibujo de codigos QR. Es lo UNICO que conoce la libreria `qrcode`; el resto
// del codigo depende de la interfaz `QrRenderer`, asi que cambiar de libreria
// (o probar con un doble en memoria) no toca las reglas de negocio.
//
// Decisiones de dibujo, pensadas para que el codigo se lea bien impreso:
//   - Correccion de errores "Q" (~25 %): aguanta roces y mala impresion.
//   - Margen de 4 modulos: es la "zona de silencio" que pide el estandar.
//   - Modulos casi negros sobre blanco puro: maximo contraste. Nunca
//     invertir los colores: muchos lectores no leen QR blanco sobre negro.

import QRCode from 'qrcode';

export interface QrRenderer {
  // Imagen vectorial: sirve para imprimir en cualquier tamano sin perder nitidez.
  svg(text: string): Promise<string>;
  // Imagen de puntos de PNG_SIZE_PX de lado: para redes y pantallas.
  png(text: string): Promise<Uint8Array>;
}

export const PNG_SIZE_PX = 1200;
export const SVG_DEFAULT_SIZE_PX = 1024;

const COLORS = { dark: '#0a0a0a', light: '#ffffff' } as const;
const BASE_OPTIONS = { errorCorrectionLevel: 'Q', margin: 4, color: COLORS } as const;

export class QrCodeRenderer implements QrRenderer {
  svg(text: string): Promise<string> {
    // El ancho solo fija el tamano por defecto al abrirlo en un editor; el
    // dibujo sigue siendo escalable por el viewBox.
    return QRCode.toString(text, { ...BASE_OPTIONS, type: 'svg', width: SVG_DEFAULT_SIZE_PX });
  }

  async png(text: string): Promise<Uint8Array> {
    const buffer = await QRCode.toBuffer(text, { ...BASE_OPTIONS, type: 'png', width: PNG_SIZE_PX });
    return new Uint8Array(buffer);
  }
}
