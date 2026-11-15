// Raiz de composicion de los productores: el UNICO lugar que decide que
// implementaciones reales usan los servicios.
//
//   ProducerAccessService
//     ├─ SupabaseProducerRepository   (cliente service_role)
//     ├─ SupabaseAccessDirectory      (Supabase Auth)
//     ├─ ResendInviteMailer           (correo de invitacion)
//     └─ getAppOrigin                 (direccion del panel para el enlace)
//   ProducerPayoutService          (como cobra el productor y registro de pagos)
//     ├─ SupabaseProducerRepository
//     └─ ResendPayoutMailer           (aviso al productor cuando se le paga)
//   ProducerProfileService
//     ├─ SupabaseProducerRepository
//     └─ SupabaseProducerPhotoStore   (bucket beats-covers, carpeta productores/)

import { getAppOrigin } from '@/lib/app-origin';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { ProducerAccessService } from './access-service';
import { ProducerPayoutService } from './payout-service';
import { ProducerProfileService } from './profile-service';
import { SupabaseProducerPhotoStore } from './supabase-photo-store';
import { ResendInviteMailer } from './invite-email';
import { ResendPayoutMailer } from './payout-email';
import { SupabaseProducerRepository } from './repository';
import { SupabaseAccessDirectory } from './supabase-access-directory';

export const producerRepository = new SupabaseProducerRepository(createSupabaseAdminClient);

export const producerAccessService = new ProducerAccessService(
  producerRepository,
  new SupabaseAccessDirectory(createSupabaseAdminClient),
  new ResendInviteMailer(),
  getAppOrigin
);

export const producerProfileService = new ProducerProfileService(
  producerRepository,
  new SupabaseProducerPhotoStore(createSupabaseAdminClient)
);

export const producerPayoutService = new ProducerPayoutService(producerRepository, new ResendPayoutMailer());

export type {
  PayoutDetails,
  PayoutRow,
  PendingTotal,
  ProducerAccessInfo,
  ProducerBeat,
  ProducerProfile,
  EarningRow
} from './types';
