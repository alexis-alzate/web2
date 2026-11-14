// Raiz de composicion de las solicitudes de productor: el UNICO lugar que
// decide que implementaciones reales usa el servicio.
//
//   ProducerApplicationService
//     ├─ SupabaseApplicationRepository  (tabla producer_applications)
//     ├─ SupabaseProducerRegistry       (crea / deshace la ficha en `producers`)
//     └─ ProducerAccessService          (invitacion para crear la clave)

import { producerAccessService } from '@/lib/producers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { SupabaseApplicationRepository, SupabaseProducerRegistry } from './repository';
import { ProducerApplicationService } from './service';

export const producerApplicationService = new ProducerApplicationService(
  new SupabaseApplicationRepository(createSupabaseAdminClient),
  new SupabaseProducerRegistry(createSupabaseAdminClient),
  producerAccessService
);

export type { ProducerApplication } from './types';
