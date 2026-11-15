'use server';

import { revalidatePath } from 'next/cache';
import { safeAction } from '@/lib/actions/safe-action';
import { requireActiveProducer, requireAdmin } from '@/lib/auth';
import { ValidationError } from '@/lib/errors';
import { producerPayoutService } from '@/lib/producers';

// Controladores delgados de los pagos a productores. El productor sale SIEMPRE
// de la sesion y el nombre de quien paga, de la cuenta del admin: nada de eso
// viaja en el formulario.

// El productor dice donde quiere recibir su plata.
export const saveProducerPayoutDetailsAction = safeAction(async (formData: FormData) => {
  const access = await requireActiveProducer();

  await producerPayoutService.saveDetails(access.producerId, {
    method: formData.get('method'),
    account: formData.get('account'),
    holder: formData.get('holder')
  });

  revalidatePath('/productor');
  revalidatePath('/');
});

// Solo admin: registrar que ya transfirio lo pendiente a un productor.
export const registerProducerPayoutAction = safeAction(async (formData: FormData) => {
  const access = await requireAdmin();

  const producerId = String(formData.get('producerId') ?? '').trim();
  if (!producerId) throw new ValidationError('El productor es obligatorio.');
  // La casilla es el "si, ya transferi": sin ella no se registra nada.
  if (formData.get('confirmed') !== 'on') {
    throw new ValidationError('Marca la casilla para confirmar que ya hiciste la transferencia.');
  }

  const result = await producerPayoutService.registerPayout(producerId, {
    reference: formData.get('reference'),
    paidBy: access.user.email ?? access.user.id
  });

  revalidatePath('/');
  revalidatePath('/productor');
  return result;
});
