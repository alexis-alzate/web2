'use server';

import { revalidatePath } from 'next/cache';
import { safeAction } from '@/lib/actions/safe-action';
import { requireAdmin } from '@/lib/auth';
import { ValidationError } from '@/lib/errors';
import { producerApplicationService } from '@/lib/producer-applications';

// Controladores delgados de las solicitudes de productor: leen el formulario,
// comprueban que quien llama es admin y delegan en ProducerApplicationService.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const applicationId = (formData: FormData) => {
  const id = String(formData.get('id') || '');
  if (!UUID_PATTERN.test(id)) throw new ValidationError('Solicitud invalida.');
  return id;
};

export const approveProducerApplicationAction = safeAction(async (formData: FormData) => {
  await requireAdmin();
  await producerApplicationService.approve(applicationId(formData), formData.get('commission'));
  revalidatePath('/');
});

export const rejectProducerApplicationAction = safeAction(async (formData: FormData) => {
  await requireAdmin();
  await producerApplicationService.reject(applicationId(formData));
  revalidatePath('/');
});
