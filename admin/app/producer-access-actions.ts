'use server';

import { revalidatePath } from 'next/cache';
import { safeAction } from '@/lib/actions/safe-action';
import { isAccessStatus, requireAdmin } from '@/lib/auth';
import { ValidationError } from '@/lib/errors';
import { producerAccessService } from '@/lib/producers';

// Controladores delgados del acceso de los productores: leen el formulario,
// comprueban que quien llama es admin y delegan en ProducerAccessService, que
// tiene las reglas. Envueltos en safeAction para que el motivo de un fallo
// llegue completo a la pantalla.

const requiredText = (formData: FormData, field: string, label: string) => {
  const value = String(formData.get(field) || '').trim();
  if (!value) throw new ValidationError(`${label} es obligatorio.`);
  return value;
};

export const inviteProducerAccessAction = safeAction(async (formData: FormData) => {
  await requireAdmin();
  const producerId = requiredText(formData, 'producerId', 'El productor');
  const email = requiredText(formData, 'email', 'El correo');

  await producerAccessService.invite(producerId, email);
  revalidatePath('/');
});

export const setProducerAccessStatusAction = safeAction(async (formData: FormData) => {
  await requireAdmin();
  const userId = requiredText(formData, 'userId', 'El usuario');
  const status = requiredText(formData, 'accessStatus', 'El estado');
  if (!isAccessStatus(status)) throw new ValidationError('El estado no es válido.');

  await producerAccessService.setStatus(userId, status);
  revalidatePath('/');
});

export const unlinkProducerAccessAction = safeAction(async (formData: FormData) => {
  await requireAdmin();
  const userId = requiredText(formData, 'userId', 'El usuario');
  const confirmation = requiredText(formData, 'confirmation', 'La confirmación');
  if (confirmation !== 'DESVINCULAR') {
    throw new ValidationError('Escribe DESVINCULAR para confirmar el cambio de correo.');
  }

  await producerAccessService.unlink(userId);
  revalidatePath('/');
});
