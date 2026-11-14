// Cifras que ve el productor, calculadas a partir de sus ventas. Funcion pura:
// recibe las filas y la fecha de hoy, y se prueba sin base de datos.

import type { EarningRow } from './types';

// Colombia no tiene horario de verano: siempre UTC-5. El mes de una venta se
// cuenta con la hora de Colombia, no la del servidor.
const COLOMBIA_OFFSET_MS = -5 * 60 * 60 * 1000;

const monthKey = (date: Date) => {
  const local = new Date(date.getTime() + COLOMBIA_OFFSET_MS);
  return `${local.getUTCFullYear()}-${local.getUTCMonth()}`;
};

export interface EarningsSummary {
  // Ventas que cuentan (las canceladas no).
  salesCount: number;
  // Lo que le corresponde al productor en total.
  producerTotal: number;
  // De ese total: lo que Lujo Urban todavia le debe y lo que ya le pago.
  pendingAmount: number;
  paidAmount: number;
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
    monthSalesCount: 0,
    monthProducerTotal: 0
  };

  for (const row of rows) {
    if (row.status === 'cancelled') continue;

    summary.salesCount += 1;
    summary.producerTotal += row.producerAmount;
    if (row.status === 'paid') summary.paidAmount += row.producerAmount;
    else summary.pendingAmount += row.producerAmount;

    if (monthKey(new Date(row.createdAt)) === currentMonth) {
      summary.monthSalesCount += 1;
      summary.monthProducerTotal += row.producerAmount;
    }
  }

  return summary;
};
