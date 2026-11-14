import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, RateLimitError, ValidationError } from '@/lib/errors';
import { normalizeMusicUrl, parseApplication, parseCommission } from '@/lib/producer-applications/rules';
import { MAX_APPLICATIONS_PER_HOUR, ProducerApplicationService } from '@/lib/producer-applications/service';
import type {
  ApplicationRepository,
  ProducerApplication,
  ProducerInviter,
  ProducerRegistry
} from '@/lib/producer-applications/types';

const valid = { stage_name: 'Kaleb Beats', email: ' Kaleb@Correo.com ', music_url: 'instagram.com/kalebbeats' };

describe('normalizeMusicUrl', () => {
  it('agrega https y conserva la ruta', () => {
    expect(normalizeMusicUrl('instagram.com/kalebbeats')).toBe('https://instagram.com/kalebbeats');
    expect(normalizeMusicUrl('https://youtube.com/@kaleb')).toBe('https://youtube.com/@kaleb');
  });

  it('sube http a https', () => {
    expect(normalizeMusicUrl('http://beatstars.com/kaleb')).toBe('https://beatstars.com/kaleb');
  });

  it('rechaza esquemas peligrosos y textos que no son enlaces', () => {
    expect(normalizeMusicUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeMusicUrl('data:text/html,hola')).toBeNull();
    expect(normalizeMusicUrl('mailto:a@b.com')).toBeNull();
    expect(normalizeMusicUrl('ftp://x.com/a')).toBeNull();
    expect(normalizeMusicUrl('solo texto')).toBeNull();
    expect(normalizeMusicUrl('')).toBeNull();
    expect(normalizeMusicUrl(undefined)).toBeNull();
  });
});

describe('parseApplication', () => {
  it('normaliza el correo a minusculas y limpia los espacios', () => {
    expect(parseApplication(valid)).toEqual({
      stageName: 'Kaleb Beats',
      email: 'kaleb@correo.com',
      musicUrl: 'https://instagram.com/kalebbeats'
    });
  });

  it.each([
    [{ ...valid, stage_name: 'K' }, 'nombre artístico'],
    [{ ...valid, email: 'no-es-correo' }, 'correo'],
    [{ ...valid, music_url: 'nada' }, 'música']
  ])('rechaza datos incompletos (%#)', (body, text) => {
    expect(() => parseApplication(body)).toThrow(ValidationError);
    expect(() => parseApplication(body)).toThrow(text);
  });

  it('no revienta con un cuerpo que no es objeto', () => {
    expect(() => parseApplication(null)).toThrow(ValidationError);
    expect(() => parseApplication('x')).toThrow(ValidationError);
  });
});

describe('parseCommission', () => {
  it('usa 15 cuando viene vacio', () => {
    expect(parseCommission('')).toBe(15);
    expect(parseCommission(undefined)).toBe(15);
    expect(parseCommission(null)).toBe(15);
  });

  it('acepta decimales con coma o punto y los redondea a 2 decimales', () => {
    expect(parseCommission('12,5')).toBe(12.5);
    expect(parseCommission('20')).toBe(20);
    expect(parseCommission('10.126')).toBe(10.13);
  });

  it('rechaza valores fuera de 0 a 100 o que no son numeros', () => {
    expect(() => parseCommission('-1')).toThrow(ValidationError);
    expect(() => parseCommission('101')).toThrow(ValidationError);
    expect(() => parseCommission('abc')).toThrow(ValidationError);
  });
});

class FakeApplications implements ApplicationRepository {
  rows: ProducerApplication[] = [];
  recentCount = 0;
  failAttach = false;
  private nextId = 1;

  async insert(input: { stageName: string; email: string; musicUrl: string }) {
    if (this.rows.some(row => row.email === input.email)) return 'duplicate' as const;
    this.rows.push({
      id: `app-${this.nextId++}`,
      stageName: input.stageName,
      email: input.email,
      musicUrl: input.musicUrl,
      status: 'new',
      producerId: null,
      createdAt: '2026-11-14T12:00:00Z'
    });
    return 'created' as const;
  }
  async countSince() { return this.recentCount; }
  async findById(id: string) { return this.rows.find(row => row.id === id) ?? null; }
  async list() { return [...this.rows]; }
  async claim(id: string) {
    const row = this.rows.find(item => item.id === id);
    if (!row || row.status !== 'new') return false;
    row.status = 'approved';
    return true;
  }
  async release(id: string) {
    const row = this.rows.find(item => item.id === id);
    if (row) { row.status = 'new'; row.producerId = null; }
  }
  async attachProducer(id: string, producerId: string) {
    if (this.failAttach) throw new Error('boom');
    const row = this.rows.find(item => item.id === id);
    if (row) row.producerId = producerId;
  }
  async reject(id: string) {
    const row = this.rows.find(item => item.id === id);
    if (!row || row.status !== 'new') return false;
    row.status = 'rejected';
    return true;
  }
}

class FakeRegistry implements ProducerRegistry {
  created: Array<{ id: string; stageName: string; email: string; commissionPercent: number }> = [];
  removed: string[] = [];
  async create(input: { stageName: string; email: string; commissionPercent: number }) {
    const id = `prod-${this.created.length + 1}`;
    this.created.push({ id, ...input });
    return id;
  }
  async remove(id: string) {
    this.removed.push(id);
    this.created = this.created.filter(item => item.id !== id);
  }
}

class FakeInviter implements ProducerInviter {
  invited: Array<{ producerId: string; email: string }> = [];
  fail = false;
  async invite(producerId: string, email: string) {
    if (this.fail) throw new ConflictError('Ese correo ya pertenece a otra clase de acceso del panel.');
    this.invited.push({ producerId, email });
  }
}

const build = () => {
  const applications = new FakeApplications();
  const registry = new FakeRegistry();
  const inviter = new FakeInviter();
  const service = new ProducerApplicationService(applications, registry, inviter, () => new Date('2026-11-14T12:00:00Z'));
  return { service, applications, registry, inviter };
};

describe('ProducerApplicationService.submit', () => {
  it('guarda la solicitud sin crear productor ni enviar invitacion', async () => {
    const { service, applications, registry, inviter } = build();
    expect(await service.submit(valid, null)).toBe('created');
    expect(applications.rows).toHaveLength(1);
    expect(registry.created).toHaveLength(0);
    expect(inviter.invited).toHaveLength(0);
  });

  it('repetir el correo no crea otra fila', async () => {
    const { service, applications } = build();
    await service.submit(valid, null);
    expect(await service.submit({ ...valid, email: 'KALEB@correo.com' }, null)).toBe('duplicate');
    expect(applications.rows).toHaveLength(1);
  });

  it('corta cuando se llega al tope por hora', async () => {
    const { service, applications } = build();
    applications.recentCount = MAX_APPLICATIONS_PER_HOUR;
    await expect(service.submit(valid, null)).rejects.toBeInstanceOf(RateLimitError);
    expect(applications.rows).toHaveLength(0);
  });

  it('valida antes de tocar la base', async () => {
    const { service, applications } = build();
    await expect(service.submit({ ...valid, email: 'x' }, null)).rejects.toBeInstanceOf(ValidationError);
    expect(applications.rows).toHaveLength(0);
  });
});

describe('ProducerApplicationService.approve', () => {
  const withApplication = async () => {
    const ctx = build();
    await ctx.service.submit(valid, null);
    return { ...ctx, id: ctx.applications.rows[0].id };
  };

  it('crea al productor con la comision, lo invita y deja la solicitud aprobada', async () => {
    const { service, applications, registry, inviter, id } = await withApplication();
    await service.approve(id, '15');
    expect(registry.created).toEqual([
      { id: 'prod-1', stageName: 'Kaleb Beats', email: 'kaleb@correo.com', commissionPercent: 15 }
    ]);
    expect(inviter.invited).toEqual([{ producerId: 'prod-1', email: 'kaleb@correo.com' }]);
    expect(applications.rows[0]).toMatchObject({ status: 'approved', producerId: 'prod-1' });
  });

  it('usa 15 % si no se escribe comision', async () => {
    const { service, registry, id } = await withApplication();
    await service.approve(id, '');
    expect(registry.created[0].commissionPercent).toBe(15);
  });

  it('si la invitacion falla, deshace todo y la solicitud vuelve a "por revisar"', async () => {
    const { service, applications, registry, inviter, id } = await withApplication();
    inviter.fail = true;
    await expect(service.approve(id, '15')).rejects.toBeInstanceOf(ConflictError);
    expect(registry.created).toHaveLength(0);
    expect(registry.removed).toEqual(['prod-1']);
    expect(applications.rows[0]).toMatchObject({ status: 'new', producerId: null });
  });

  it('si falla vincular el productor, tambien deshace', async () => {
    const { service, applications, registry, id } = await withApplication();
    applications.failAttach = true;
    await expect(service.approve(id, '15')).rejects.toThrow('boom');
    expect(registry.created).toHaveLength(0);
    expect(applications.rows[0].status).toBe('new');
  });

  it('no aprueba dos veces la misma solicitud', async () => {
    const { service, registry, id } = await withApplication();
    await service.approve(id, '15');
    await expect(service.approve(id, '15')).rejects.toBeInstanceOf(ConflictError);
    expect(registry.created).toHaveLength(1);
  });

  it('no aprueba una solicitud rechazada ni una que no existe', async () => {
    const { service, id } = await withApplication();
    await service.reject(id);
    await expect(service.approve(id, '15')).rejects.toBeInstanceOf(ConflictError);
    await expect(service.approve('app-99', '15')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rechaza una comision invalida sin tocar nada', async () => {
    const { service, registry, applications, id } = await withApplication();
    await expect(service.approve(id, '150')).rejects.toBeInstanceOf(ValidationError);
    expect(registry.created).toHaveLength(0);
    expect(applications.rows[0].status).toBe('new');
  });
});

describe('ProducerApplicationService.reject', () => {
  it('marca la solicitud como rechazada sin crear nada', async () => {
    const { service, applications, registry, inviter } = build();
    await service.submit(valid, null);
    await service.reject(applications.rows[0].id);
    expect(applications.rows[0].status).toBe('rejected');
    expect(registry.created).toHaveLength(0);
    expect(inviter.invited).toHaveLength(0);
  });

  it('no rechaza una solicitud ya aprobada', async () => {
    const { service, applications } = build();
    await service.submit(valid, null);
    await service.approve(applications.rows[0].id, '15');
    await expect(service.reject(applications.rows[0].id)).rejects.toBeInstanceOf(ConflictError);
  });
});
