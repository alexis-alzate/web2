// Como se guarda en la cuenta (app_metadata) que alguien es productor. Son
// funciones puras: reciben los metadatos actuales y devuelven los nuevos.

import type { AccessStatus } from './types';

export const PRODUCER_ROLE = 'producer';

export const linkedProducerId = (metadata: Record<string, unknown>): string =>
  metadata.lujo_role === PRODUCER_ROLE && typeof metadata.lujo_producer_id === 'string'
    ? metadata.lujo_producer_id.trim()
    : '';

export const producerMetadata = (
  current: Record<string, unknown>,
  producerId: string,
  status: AccessStatus
): Record<string, unknown> => {
  const next = { ...current };
  delete next.lujo_unlinked_at;
  return {
    ...next,
    lujo_role: PRODUCER_ROLE,
    lujo_producer_id: producerId,
    lujo_access: status
  };
};

export const unlinkedProducerMetadata = (
  current: Record<string, unknown>,
  now: Date
): Record<string, unknown> => ({
  ...current,
  lujo_role: PRODUCER_ROLE,
  lujo_producer_id: null,
  lujo_access: 'inactive',
  lujo_unlinked_at: now.toISOString()
});
