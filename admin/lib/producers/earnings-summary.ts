// Cifras que ve el productor, calculadas a partir de sus ventas. Funcion pura:
// recibe las filas y la fecha de hoy, y se prueba sin base de datos.

import { formatSaleDate } from './format';
import type { EarningRow } from './types';

// Colombia no tiene horario de verano: siempre UTC-5. El mes de una venta se
// cuenta con la hora de Colombia, no la del servidor.
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

const monthKey = (date: Date) => {
  const local = new Date(date.getTime() + COLOMBIA_OFFSET_MS);
  return `${local.getUTCFullYear()}-${local.getUTCMonth()}`;
};

// En que punto va una venta:
//   holding   = pendiente, todavia en los dias de espera
//   available = pendiente y ya liberada: entra en el siguiente pago
//   paid / cancelled = como dice su estado
export type EarningPhase = 'holding' | 'available' | 'paid' | 'cancelled';

export const earningPhase = (
  row: { status: 'pending' | 'paid' | 'cancelled'; availableAt: string },
  now: Date = new Date()
): EarningPhase => {
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'paid') return 'paid';
  return new Date(row.availableAt).getTime() <= now.getTime() ? 'available' : 'holding';
};

// Texto corto para la fila de cada venta del portal.
export const earningPhaseLabel = (
  row: { status: 'pending' | 'paid' | 'cancelled'; availableAt: string },
  now: Date = new Date()
): string => {
  const phase = earningPhase(row, now);
  if (phase === 'paid') return 'Pagada';
  if (phase === 'holding') return `En espera · se libera el ${formatSaleDate(row.availableAt)}`;
  if (phase === 'available') return 'Disponible · entra en tu próximo pago';
  return 'Cancelada';
};

export interface EarningsSummary {
  // Ventas que cuentan (las canceladas no).
  salesCount: number;
  // Lo que le corresponde al productor en total.
  producerTotal: number;
  // De ese total: lo que Lujo Urban todavia le debe y lo que ya le pago.
  pendingAmount: number;
  paidAmount: number;
  // Lo pendiente, partido: ya liberado (se paga en el siguiente pago) y todavia
  // en los dias de espera, con la fecha en que se libera lo primero.
  availableAmount: number;
  holdingAmount: number;
  nextReleaseAt: string | null;
  monthSalesCount: number;
  monthProducerTotal: number;
}

export const summarizeEarnings = (rows: EarningRow[], now: Date = new Date()): EarningsSummary => {
  const currentMonth = monthKey(now);
  const summary: EarningsSummary = {
    salesCount: 0,
    producerTotal: 0,
    pendingAmount: 0,
    paidAmount: 0,
    availableAmount: 0,
    holdingAmount: 0,
    nextReleaseAt: null,
    monthSalesCount: 0,
    monthProducerTotal: 0
  };

  for (const row of rows) {
    if (row.status === 'cancelled') continue;

    summary.salesCount += 1;
    summary.producerTotal += row.producerAmount;
    if (row.status === 'paid') {
      summary.paidAmount += row.producerAmount;
    } else {
      summary.pendingAmount += row.producerAmount;
      if (earningPhase(row, now) === 'available') {
        summary.availableAmount += row.producerAmount;
      } else {
        summary.holdingAmount += row.producerAmount;
        if (!summary.nextReleaseAt || row.availableAt < summary.nextReleaseAt) summary.nextReleaseAt = row.availableAt;
      }
    }

    if (monthKey(new Date(row.createdAt)) === currentMonth) {
      summary.monthSalesCount += 1;
      summary.monthProducerTotal += row.producerAmount;
    }
  }

  return summary;
};
