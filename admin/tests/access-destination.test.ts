import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { destinationFor } from '@/lib/access-destination';
import { readAccessMetadata } from '@/lib/auth';

const user = (appMetadata: Record<string, unknown>) => ({ id: 'u', app_metadata: appMetadata }) as unknown as User;

describe('readAccessMetadata', () => {
  it('lee a un productor con su id', () => {
    const access = readAccessMetadata(user({ lujo_role: 'producer', lujo_producer_id: ' prod-1 ', lujo_access: 'active' }));
    expect(access).toMatchObject({ role: 'producer', producerId: 'prod-1', status: 'active', artistSlug: null });
  });

  it('un productor sin vinculo no tiene id', () => {
    const access = readAccessMetadata(user({ lujo_role: 'producer', lujo_producer_id: null, lujo_access: 'inactive' }));
    expect(access.producerId).toBeNull();
  });

  it('el id de productor solo vale para el rol productor', () => {
    const access = readAccessMetadata(user({ lujo_role: 'artist', lujo_producer_id: 'prod-1', lujo_artist_slug: 'x' }));
    expect(access.producerId).toBeNull();
    expect(access.artistSlug).toBe('x');
  });

  it('un rol desconocido queda sin rol', () => {
    expect(readAccessMetadata(user({ lujo_role: 'superuser' })).role).toBeNull();
  });
});

describe('destinationFor', () => {
  const base = { artistSlug: null, producerId: null };

  it('cada rol entra solo a su zona', () => {
    expect(destinationFor({ ...base, role: 'admin', status: 'active' })).toBe('/');
    expect(destinationFor({ ...base, role: 'artist', status: 'active', artistSlug: 'julian' })).toBe('/mi-perfil');
    expect(destinationFor({ ...base, role: 'producer', status: 'active', producerId: 'prod-1' })).toBe('/productor');
  });

  it('un admin pausado no entra', () => {
    expect(destinationFor({ ...base, role: 'admin', status: 'suspended' })).toBeNull();
  });

  it('artistas y productores pausados si entran, para ver el aviso', () => {
    expect(destinationFor({ ...base, role: 'artist', status: 'suspended', artistSlug: 'julian' })).toBe('/mi-perfil');
    expect(destinationFor({ ...base, role: 'producer', status: 'suspended', producerId: 'prod-1' })).toBe('/productor');
  });

  it('sin vinculo no hay destino', () => {
    expect(destinationFor({ ...base, role: 'artist', status: 'active' })).toBeNull();
    expect(destinationFor({ ...base, role: 'producer', status: 'active' })).toBeNull();
    expect(destinationFor({ ...base, role: null, status: 'active' })).toBeNull();
    expect(destinationFor(null)).toBeNull();
  });
});
