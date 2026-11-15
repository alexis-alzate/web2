import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  HOLD_DAYS,
  MIN_PAYOUT_AMOUNT,
  isPayoutMethod,
  maskAccount,
  parsePayoutDetails,
  parseReference,
  payoutMethodLabel
} from '@/lib/producers/payout-rules';
import { ProducerPayoutService } from '@/lib/producers/payout-service';
import { SupabaseProducerRepository } from '@/lib/producers/repository';
import type { PayoutDetails, PayoutMailer, PayoutNotice, PayoutResult, ProducerProfile, ProducerRepository } from '@/lib/producers/types';
import { PRODUCER } from './producer-helpers';

const NEQUI: PayoutDetails = { method: 'nequi', account: '3001234567', holder: 'Helmer Perez' };

describe('parsePayoutDetails', () => {
  it('acepta un Nequi y deja solo los digitos', () => {
    expect(parsePayoutDetails({ method: 'nequi', account: '300 123 4567', holder: ' Helmer   Perez ' })).toEqual(NEQUI);
  });

  it('quita el prefijo +57 y los guiones', () => {
    expect(parsePayoutDetails({ method: 'daviplata', account: '+57 300-123-4567', holder: 'Ana Gil' }).account).toBe('3001234567');
  });

  it.each(['2001234567', '300123456', '30012345678', 'tres cero cero', ''])(
    'rechaza un celular invalido (%s)',
    account => {
      expect(() => parsePayoutDetails({ method: 'nequi', account, holder: 'Ana Gil' })).toThrow(ValidationError);
    }
  );

  it('acepta una cuenta Bancolombia solo con digitos', () => {
    expect(parsePayoutDetails({ method: 'bancolombia', account: '123-456 789 01', holder: 'Ana Gil' }).account).toBe('12345678901');
    expect(() => parsePayoutDetails({ method: 'bancolombia', account: '1234567', holder: 'Ana Gil' })).toThrow(ValidationError);
    expect(() => parsePayoutDetails({ method: 'bancolombia', account: '12345678a', holder: 'Ana Gil' })).toThrow(ValidationError);
  });

  it('en "otro" pide un texto util y respeta el limite', () => {
    expect(parsePayoutDetails({ method: 'otro', account: 'Davivienda ahorros 123456', holder: 'Ana Gil' }).method).toBe('otro');
    expect(() => parsePayoutDetails({ method: 'otro', account: 'abc', holder: 'Ana Gil' })).toThrow(ValidationError);
    expect(() => parsePayoutDetails({ method: 'otro', account: 'x'.repeat(81), holder: 'Ana Gil' })).toThrow(ValidationError);
  });

  it('rechaza un metodo desconocido o ausente', () => {
    expect(() => parsePayoutDetails({ method: 'paypal', account: '3001234567', holder: 'Ana Gil' })).toThrow(ValidationError);
    expect(() => parsePayoutDetails({ method: undefined, account: '3001234567', holder: 'Ana Gil' })).toThrow(ValidationError);
    expect(isPayoutMethod('nequi')).toBe(true);
    expect(isPayoutMethod('efectivo')).toBe(false);
  });

  it('exige el titular y limita su largo', () => {
    expect(() => parsePayoutDetails({ method: 'nequi', account: '3001234567', holder: '  ' })).toThrow(ValidationError);
    expect(() => parsePayoutDetails({ method: 'nequi', account: '3001234567', holder: 'ab' })).toThrow(ValidationError);
    expect(() => parsePayoutDetails({ method: 'nequi', account: '3001234567', holder: 'a'.repeat(81) })).toThrow(ValidationError);
  });

  it('limpia saltos de linea y caracteres de control', () => {
    expect(parsePayoutDetails({ method: 'nequi', account: '3001234567', holder: 'Ana\n\tGil\u0000' }).holder).toBe('Ana Gil');
  });

  it('da etiquetas legibles', () => {
    expect(payoutMethodLabel('nequi')).toBe('Nequi');
    expect(payoutMethodLabel('otro')).toBe('Otro banco');
  });
});

describe('parseReference', () => {
  it('recorta y acepta una referencia normal', () => {
    expect(parseReference('  Comprobante 884512 ')).toBe('Comprobante 884512');
  });

  it('exige que no este vacia y limita el largo', () => {
    expect(() => parseReference('   ')).toThrow(ValidationError);
    expect(() => parseReference(null)).toThrow(ValidationError);
    expect(() => parseReference('x'.repeat(121))).toThrow(ValidationError);
    expect(parseReference('x'.repeat(120))).toHaveLength(120);
  });
});

class FakeProducers implements Pick<ProducerRepository, 'findById' | 'updatePayoutDetails' | 'registerPayout'> {
  saved: Array<{ producerId: string; details: PayoutDetails }> = [];
  registered: Array<Parameters<ProducerRepository['registerPayout']>[0]> = [];
  result: PayoutResult = { payoutId: 'pay-1', amount: 17000, earningsCount: 2 };

  constructor(private producer: ProducerProfile | null) {}

  async findById(id: string) {
    return this.producer && this.producer.id === id ? this.producer : null;
  }

  async updatePayoutDetails(producerId: string, details: PayoutDetails) {
    this.saved.push({ producerId, details });
  }

  async registerPayout(input: Parameters<ProducerRepository['registerPayout']>[0]) {
    this.registered.push(input);
    return this.result;
  }
}

class FakeMailer implements PayoutMailer {
  sent: PayoutNotice[] = [];
  fail = false;

  async send(notice: PayoutNotice) {
    if (this.fail) throw new Error('resend caido');
    this.sent.push(notice);
  }
}

const build = (producer: ProducerProfile | null = PRODUCER) => {
  const repo = new FakeProducers(producer);
  const mailer = new FakeMailer();
  const logged: string[] = [];
  const service = new ProducerPayoutService(repo as unknown as ProducerRepository, mailer, message => logged.push(message));
  return { repo, mailer, logged, service };
};

describe('ProducerPayoutService.saveDetails', () => {
  it('guarda los datos ya limpios', async () => {
    const { repo, service } = build();
    await service.saveDetails(PRODUCER.id, { method: 'nequi', account: '300 123 4567', holder: 'Helmer Perez' });
    expect(repo.saved).toEqual([{ producerId: PRODUCER.id, details: NEQUI }]);
  });

  it('no guarda nada si los datos son invalidos', async () => {
    const { repo, service } = build();
    await expect(service.saveDetails(PRODUCER.id, { method: 'nequi', account: '123', holder: 'Ana Gil' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(repo.saved).toEqual([]);
  });

  it('falla si el productor no existe o esta pausado', async () => {
    await expect(build(null).service.saveDetails('nadie', NEQUI)).rejects.toBeInstanceOf(NotFoundError);
    await expect(build({ ...PRODUCER, status: 'inactive' }).service.saveDetails(PRODUCER.id, NEQUI))
      .rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('ProducerPayoutService.registerPayout', () => {
  const withPayout = { ...PRODUCER, payout: NEQUI };

  it('registra el pago con la cuenta que el admin tenia en pantalla', async () => {
    const { repo, service } = build(withPayout);
    const result = await service.registerPayout(PRODUCER.id, { reference: ' Comp 123 ', paidBy: 'zaetta@correo.com' });

    expect(result.amount).toBe(17000);
    expect(repo.registered).toEqual([
      {
        producerId: PRODUCER.id,
        reference: 'Comp 123',
        paidBy: 'zaetta@correo.com',
        expectedAccount: '3001234567',
        minAmount: MIN_PAYOUT_AMOUNT
      }
    ]);
  });

  it('le avisa al productor por correo con lo que se le pago', async () => {
    const { mailer, service } = build(withPayout);
    const result = await service.registerPayout(PRODUCER.id, { reference: 'Comp 123', paidBy: 'a@b.co' });

    expect(result.notified).toBe(true);
    expect(mailer.sent).toEqual([
      {
        email: PRODUCER.email,
        stageName: PRODUCER.stageName,
        amount: 17000,
        earningsCount: 2,
        method: 'nequi',
        account: '3001234567',
        reference: 'Comp 123'
      }
    ]);
  });

  it('si el correo falla, el pago queda registrado y se avisa que no salio', async () => {
    const { repo, mailer, logged, service } = build(withPayout);
    mailer.fail = true;
    const result = await service.registerPayout(PRODUCER.id, { reference: 'Comp 123', paidBy: 'a@b.co' });

    expect(repo.registered).toHaveLength(1);
    expect(result.amount).toBe(17000);
    expect(result.notified).toBe(false);
    expect(logged).toHaveLength(1);
  });

  it('si la base rechaza el pago, no se manda ningun correo', async () => {
    const { repo, mailer, service } = build(withPayout);
    repo.registerPayout = async () => { throw new ValidationError('No llega al minimo'); };
    await expect(service.registerPayout(PRODUCER.id, { reference: 'Comp 1', paidBy: 'a@b.co' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(mailer.sent).toEqual([]);
  });

  it('no paga si el productor no dijo como cobrar', async () => {
    const { repo, service } = build(PRODUCER);
    await expect(service.registerPayout(PRODUCER.id, { reference: 'Comp 1', paidBy: 'a@b.co' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(repo.registered).toEqual([]);
  });

  it('no paga sin referencia', async () => {
    const { repo, service } = build(withPayout);
    await expect(service.registerPayout(PRODUCER.id, { reference: '  ', paidBy: 'a@b.co' }))
      .rejects.toBeInstanceOf(ValidationError);
    expect(repo.registered).toEqual([]);
  });

  it('falla si el productor no existe', async () => {
    await expect(build(null).service.registerPayout('nadie', { reference: 'Comp 1', paidBy: 'a@b.co' }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('SupabaseProducerRepository.registerPayout', () => {
  const clientWith = (rpc: () => Promise<{ data: unknown; error: { message: string } | null }>) =>
    (() => ({ rpc }) as unknown as SupabaseClient);
  const input = { producerId: 'p1', reference: 'Comp 1', paidBy: 'a@b.co', expectedAccount: '3001234567', minAmount: 50_000 };

  it('traduce la respuesta de la base', async () => {
    const repo = new SupabaseProducerRepository(clientWith(async () => ({
      data: [{ out_payout_id: 'pay-9', out_amount: 5100, out_count: 3 }],
      error: null
    })));
    await expect(repo.registerPayout(input)).resolves.toEqual({ payoutId: 'pay-9', amount: 5100, earningsCount: 3 });
  });

  it('muestra tal cual los avisos "LU:" de la base como error de validacion', async () => {
    const repo = new SupabaseProducerRepository(clientWith(async () => ({
      data: null,
      error: { message: 'LU: Este productor no tiene ventas pendientes de pago.' }
    })));
    const error = await repo.registerPayout(input).catch(e => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe('Este productor no tiene ventas pendientes de pago.');
  });

  it('no filtra errores internos de la base', async () => {
    const repo = new SupabaseProducerRepository(clientWith(async () => ({
      data: null,
      error: { message: 'connection refused 10.0.0.1' }
    })));
    const error = await repo.registerPayout(input).catch(e => e);
    expect(error).not.toBeInstanceOf(ValidationError);
    expect(error.message).toContain('registrar el pago');
  });
});

describe('reglas de liberacion y minimo', () => {
  it('fija los dias de espera y el pago minimo', () => {
    expect(HOLD_DAYS).toBe(7);
    expect(MIN_PAYOUT_AMOUNT).toBe(50_000);
  });

  it('muestra solo los ultimos 4 digitos de la cuenta en el correo', () => {
    expect(maskAccount('nequi', '3001234567')).toBe('•••• 4567');
    expect(maskAccount('bancolombia', '12345678901')).toBe('•••• 8901');
    expect(maskAccount('otro', 'Davivienda ahorros 123456')).toBe('la cuenta que registraste');
  });
});

describe('SupabaseProducerRepository.registerPayout (minimo)', () => {
  it('manda el pago minimo a la base', async () => {
    let received: Record<string, unknown> | null = null;
    const repo = new SupabaseProducerRepository((() => ({
      rpc: async (_name: string, args: Record<string, unknown>) => {
        received = args;
        return { data: [{ out_payout_id: 'p', out_amount: 60000, out_count: 2 }], error: null };
      }
    }) as unknown as SupabaseClient));
    await repo.registerPayout({ producerId: 'p1', reference: 'R', paidBy: 'a@b.co', expectedAccount: '3001234567', minAmount: 50_000 });
    expect(received).toMatchObject({ p_min_amount: 50_000, p_expected_account: '3001234567' });
  });
});

describe('SupabaseProducerRepository.pendingTotals', () => {
  // Cadena minima del cliente: from().select().eq().order().range() -> filas.
  const clientWith = (rows: unknown[]) =>
    (() => ({
      from: () => {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.order = () => chain;
        chain.range = async () => ({ data: rows, error: null });
        return chain;
      }
    }) as unknown as SupabaseClient);

  it('separa lo liberado de lo que sigue en espera, por productor', async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const repo = new SupabaseProducerRepository(clientWith([
      { id: '1', producer_id: 'p1', producer_amount: 40_000, available_at: past },
      { id: '2', producer_id: 'p1', producer_amount: 30_000, available_at: later },
      { id: '3', producer_id: 'p1', producer_amount: 20_000, available_at: soon },
      { id: '4', producer_id: 'p2', producer_amount: 5_000, available_at: past }
    ]));

    const totals = await repo.pendingTotals();
    expect(totals.get('p1')).toEqual({
      amount: 90_000,
      count: 3,
      availableAmount: 40_000,
      availableCount: 1,
      holdingAmount: 50_000,
      nextReleaseAt: soon
    });
    expect(totals.get('p2')).toMatchObject({ availableAmount: 5_000, holdingAmount: 0, nextReleaseAt: null });
  });
});
