import { describe, expect, it } from 'vitest';
import { summarizeEarnings } from '@/lib/producers/earnings-summary';
import { formatCOP, formatSaleDate } from '@/lib/producers/format';
import type { EarningRow } from '@/lib/producers/types';

const row = (patch: Partial<EarningRow>): EarningRow => ({
  id: 'e',
  beatTitle: 'Beat',
  license: 'basic',
  grossAmount: 100_000,
  platformFeeAmount: 15_000,
  producerAmount: 85_000,
  status: 'pending',
  createdAt: '2026-11-10T15:00:00Z',
  ...patch
});

const NOW = new Date('2026-11-14T15:00:00Z');

describe('summarizeEarnings', () => {
  it('sin ventas devuelve todo en cero', () => {
    expect(summarizeEarnings([], NOW)).toEqual({
      salesCount: 0,
      producerTotal: 0,
      pendingAmount: 0,
      paidAmount: 0,
      monthSalesCount: 0,
      monthProducerTotal: 0
    });
  });

  it('suma lo pendiente y lo pagado por separado', () => {
    const summary = summarizeEarnings(
      [row({ producerAmount: 85_000 }), row({ producerAmount: 170_000, status: 'paid' })],
      NOW
    );
    expect(summary.salesCount).toBe(2);
    expect(summary.producerTotal).toBe(255_000);
    expect(summary.pendingAmount).toBe(85_000);
    expect(summary.paidAmount).toBe(170_000);
  });

  it('ignora las ventas canceladas', () => {
    const summary = summarizeEarnings([row({ status: 'cancelled' }), row({})], NOW);
    expect(summary.salesCount).toBe(1);
    expect(summary.producerTotal).toBe(85_000);
  });

  it('cuenta el mes con la hora de Colombia', () => {
    // 1 nov 02:00 UTC todavia es 31 oct en Colombia (UTC-5): cuenta como octubre.
    const lateOctober = row({ createdAt: '2026-11-01T02:00:00Z' });
    // 1 nov 06:00 UTC ya es 1 nov en Colombia: cuenta como noviembre.
    const earlyNovember = row({ createdAt: '2026-11-01T06:00:00Z' });

    const summary = summarizeEarnings([lateOctober, earlyNovember], NOW);

    expect(summary.salesCount).toBe(2);
    expect(summary.monthSalesCount).toBe(1);
    expect(summary.monthProducerTotal).toBe(85_000);
  });

  it('el mes de "hoy" tambien se mide en hora de Colombia', () => {
    // Para el servidor ya es diciembre, pero en Colombia sigue siendo 30 nov.
    const now = new Date('2026-12-01T03:00:00Z');
    const summary = summarizeEarnings([row({ createdAt: '2026-11-20T12:00:00Z' })], now);
    expect(summary.monthSalesCount).toBe(1);
  });
});

describe('formato', () => {
  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCOP(85_000).replace(/\s/g, ' ')).toMatch(/85\.000/);
    expect(formatCOP(0)).toMatch(/0/);
  });

  it('formatea la fecha con el dia de Colombia', () => {
    // 03:00 UTC del 15 es todavia el 14 en Colombia.
    expect(formatSaleDate('2026-11-15T03:00:00Z')).toContain('14');
  });
});
