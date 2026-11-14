import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { buildAccessService, PRODUCER } from './producer-helpers';

describe('ProducerAccessService.invite', () => {
  it('crea la cuenta, la vincula y manda el correo con el enlace de dos pasos', async () => {
    const { service, directory, mailer } = buildAccessService();

    const result = await service.invite('prod-1', '  Helmentt@Correo.com ');

    expect(result).toEqual({ kind: 'invited', email: 'helmentt@correo.com' });
    expect(directory.users).toHaveLength(1);
    expect(directory.users[0].metadata).toMatchObject({
      lujo_role: 'producer',
      lujo_producer_id: 'prod-1',
      lujo_access: 'active'
    });

    expect(mailer.sent).toHaveLength(1);
    const link = new URL(mailer.sent[0].link);
    expect(link.origin + link.pathname).toBe('https://admin.lujourban.com/auth/confirm');
    expect(link.searchParams.get('type')).toBe('invite');
    expect(link.searchParams.get('next')).toBe('/reset-password');
    expect(link.searchParams.get('token_hash')).toBe('hash-u1');
    expect(mailer.sent[0].stageName).toBe('Helmentt');
  });

  it('el correo lleva el enlace de su tienda', async () => {
    const { service, mailer } = buildAccessService();
    await service.invite('prod-1', 'helmentt@correo.com');
    expect(mailer.sent[0].storeUrl).toBe('https://tienda.lujourban.com/productor/helmentt');
  });

  it('sin slug no inventa una tienda: el correo sale sin ese bloque', async () => {
    const { service, mailer } = buildAccessService({ ...PRODUCER, slug: null });
    await service.invite('prod-1', 'helmentt@correo.com');
    expect(mailer.sent[0].storeUrl).toBeNull();
  });

  it('rechaza un correo mal escrito sin tocar nada', async () => {
    const { service, directory } = buildAccessService();
    await expect(service.invite('prod-1', 'no-es-correo')).rejects.toBeInstanceOf(ValidationError);
    expect(directory.calls).toEqual([]);
  });

  it('falla si el productor no existe', async () => {
    const { service } = buildAccessService(null);
    await expect(service.invite('prod-1', 'a@b.co')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('no invita a un productor inactivo', async () => {
    const { service } = buildAccessService({ ...PRODUCER, status: 'inactive' });
    await expect(service.invite('prod-1', 'a@b.co')).rejects.toBeInstanceOf(ValidationError);
  });

  it('no deja asignar un segundo correo al mismo productor', async () => {
    const { service, directory } = buildAccessService();
    directory.add({
      id: 'old',
      email: 'viejo@correo.com',
      metadata: { lujo_role: 'producer', lujo_producer_id: 'prod-1' }
    });

    await expect(service.invite('prod-1', 'nuevo@correo.com')).rejects.toBeInstanceOf(ConflictError);
    expect(directory.calls).toEqual([]);
  });

  it('no usa un correo que ya es de un admin o de un artista', async () => {
    const { service, directory } = buildAccessService();
    directory.add({ id: 'a1', email: 'yo@correo.com', metadata: { lujo_role: 'admin' } });

    await expect(service.invite('prod-1', 'yo@correo.com')).rejects.toBeInstanceOf(ConflictError);
  });

  it('no usa un correo que ya es de otro productor', async () => {
    const { service, directory } = buildAccessService();
    directory.add({
      id: 'p2',
      email: 'otro@correo.com',
      metadata: { lujo_role: 'producer', lujo_producer_id: 'prod-2' }
    });

    await expect(service.invite('prod-1', 'otro@correo.com')).rejects.toBeInstanceOf(ConflictError);
  });

  it('vuelve a vincular una cuenta ya confirmada y sin vinculo, sin mandar correo', async () => {
    const { service, directory, mailer } = buildAccessService();
    directory.add({
      id: 'p9',
      email: 'helmentt@correo.com',
      confirmed: true,
      metadata: { lujo_role: 'producer', lujo_producer_id: null, lujo_access: 'inactive' }
    });

    const result = await service.invite('prod-1', 'helmentt@correo.com');

    expect(result.kind).toBe('relinked');
    expect(directory.users[0].metadata).toMatchObject({ lujo_producer_id: 'prod-1', lujo_access: 'active' });
    expect(mailer.sent).toHaveLength(0);
  });

  it('renueva una invitacion que nunca se uso: borra la vieja y crea una nueva', async () => {
    const { service, directory, mailer } = buildAccessService();
    directory.add({
      id: 'p9',
      email: 'helmentt@correo.com',
      confirmed: false,
      metadata: { lujo_role: 'producer', lujo_producer_id: null }
    });

    const result = await service.invite('prod-1', 'helmentt@correo.com');

    expect(result.kind).toBe('invited');
    expect(directory.calls[0]).toBe('remove:p9');
    expect(directory.users.map(user => user.id)).toEqual(['u1']);
    expect(mailer.sent).toHaveLength(1);
  });

  it('avisa antes de crear nada si el correo no esta configurado', async () => {
    const { service, directory, mailer } = buildAccessService();
    mailer.ready = false;

    await expect(service.invite('prod-1', 'a@b.co')).rejects.toThrow('correo sin configurar');
    expect(directory.calls).toEqual([]);
  });

  it('borra la cuenta recien creada si no se pudo vincular', async () => {
    const { service, directory, mailer } = buildAccessService();
    directory.failSetMetadata = true;

    await expect(service.invite('prod-1', 'a@b.co')).rejects.toBeInstanceOf(ConflictError);
    expect(directory.users).toHaveLength(0);
    expect(mailer.sent).toHaveLength(0);
  });

  it('borra la cuenta recien creada si el correo no sale', async () => {
    const { service, directory, mailer } = buildAccessService();
    mailer.failSend = true;

    await expect(service.invite('prod-1', 'a@b.co')).rejects.toThrow('resend caido');
    expect(directory.users).toHaveLength(0);
  });
});

describe('ProducerAccessService.setStatus', () => {
  it('pausa y reactiva el acceso de un productor', async () => {
    const { service, directory } = buildAccessService();
    directory.add({
      id: 'p1',
      email: 'a@b.co',
      metadata: { lujo_role: 'producer', lujo_producer_id: 'prod-1', lujo_access: 'active' }
    });

    await service.setStatus('p1', 'suspended');
    expect(directory.users[0].metadata.lujo_access).toBe('suspended');

    await service.setStatus('p1', 'active');
    expect(directory.users[0].metadata.lujo_access).toBe('active');
  });

  it('se niega a tocar cuentas que no son de productores', async () => {
    const { service, directory } = buildAccessService();
    directory.add({ id: 'adm', email: 'adm@b.co', metadata: { lujo_role: 'admin', lujo_access: 'active' } });

    await expect(service.setStatus('adm', 'suspended')).rejects.toBeInstanceOf(ForbiddenError);
    expect(directory.users[0].metadata.lujo_access).toBe('active');
  });

  it('falla si la cuenta no existe', async () => {
    const { service } = buildAccessService();
    await expect(service.setStatus('nadie', 'active')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ProducerAccessService.unlink', () => {
  it('borra la cuenta si la persona nunca creo su clave', async () => {
    const { service, directory } = buildAccessService();
    directory.add({
      id: 'p1',
      email: 'a@b.co',
      confirmed: false,
      metadata: { lujo_role: 'producer', lujo_producer_id: 'prod-1' }
    });

    await service.unlink('p1');
    expect(directory.users).toHaveLength(0);
  });

  it('conserva la cuenta sin acceso si ya tenia clave, y libera al productor', async () => {
    const { service, directory } = buildAccessService();
    directory.add({
      id: 'p1',
      email: 'a@b.co',
      confirmed: true,
      metadata: { lujo_role: 'producer', lujo_producer_id: 'prod-1', lujo_access: 'active' }
    });

    await service.unlink('p1');

    expect(directory.users[0].metadata).toMatchObject({
      lujo_role: 'producer',
      lujo_producer_id: null,
      lujo_access: 'inactive',
      lujo_unlinked_at: '2026-11-14T12:00:00.000Z'
    });
    expect((await service.listAccess()).has('prod-1')).toBe(false);
  });
});

describe('ProducerAccessService.listAccess', () => {
  it('muestra la cuenta de cada productor con su estado', async () => {
    const { service, directory } = buildAccessService();
    directory.add({
      id: 'p1',
      email: 'a@b.co',
      confirmed: false,
      metadata: { lujo_role: 'producer', lujo_producer_id: 'prod-1', lujo_access: 'active' }
    });
    directory.add({ id: 'art', email: 'art@b.co', metadata: { lujo_role: 'artist', lujo_artist_slug: 'x' } });

    const access = await service.listAccess();

    expect([...access.keys()]).toEqual(['prod-1']);
    expect(access.get('prod-1')).toEqual({ userId: 'p1', email: 'a@b.co', status: 'active', confirmed: false });
  });
});
