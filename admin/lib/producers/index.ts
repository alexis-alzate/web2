// Raiz de composicion de los productores: el UNICO lugar que decide que
// implementaciones reales usan los servicios.
//
//   ProducerAccessService
//     ├─ SupabaseProducerRepository   (cliente service_role)
//     ├─ SupabaseAccessDirectory      (Supabase Auth)
//     ├─ ResendInviteMailer           (correo de invitacion)
//     └─ getAppOrigin                 (direccion del panel para el enlace)

import { getAppOrigin } from '@/lib/app-origin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { ProducerAccessService } from './access-service';
import { ResendInviteMailer } from './invite-email';
import { SupabaseProducerRepository } from './repository';
import { SupabaseAccessDirectory } from './supabase-access-directory';

export const producerRepository = new SupabaseProducerRepository(createSupabaseAdminClient);

export const producerAccessService = new ProducerAccessService(
  producerRepository,
  new SupabaseAccessDirectory(createSupabaseAdminClient),
  new ResendInviteMailer(),
  getAppOrigin
);

export type { ProducerAccessInfo, ProducerBeat, ProducerProfile, EarningRow } from './types';
