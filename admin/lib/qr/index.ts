// Raiz de composicion del QR: el unico lugar que elige la implementacion real
// (igual que lib/artists/index.ts). Quien necesite dibujar un QR importa
// `qrRenderer` desde '@/lib/qr'.

import { QrCodeRenderer } from './renderer';

export const qrRenderer = new QrCodeRenderer();

export type { QrRenderer } from './renderer';
