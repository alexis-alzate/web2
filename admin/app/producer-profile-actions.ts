'use server';

import { revalidatePath } from 'next/cache';
import { safeAction } from '@/lib/actions/safe-action';
import { readUploadedImage } from '@/lib/artists/images';
import { requireActiveProducer, requireAdmin } from '@/lib/auth';
import { ValidationError } from '@/lib/errors';
import { producerProfileService } from '@/lib/producers';

// Controladores delgados del perfil publico del productor. El productor sale
// SIEMPRE de la sesion, nunca del formulario: nadie puede editar el perfil de
// otro cambiando un campo.

export const saveProducerProfileAction = safeAction(async (formData: FormData) => {
  const access = await requireActiveProducer();

  await producerProfileService.update(access.producerId, {
    bio: String(formData.get('bio') ?? ''),
    photo: await readUploadedImage(formData, 'photo'),
    removePhoto: formData.get('removePhoto') === 'on'
  });

  revalidatePath('/productor');
});

// Solo admin: quitar la foto de un productor desde el panel.
export const removeProducerPhotoAction = safeAction(async (formData: FormData) => {
  await requireAdmin();
  const producerId = String(formData.get('producerId') ?? '').trim();
  if (!producerId) throw new ValidationError('El productor es obligatorio.');

  await producerProfileService.removePhoto(producerId);
  revalidatePath('/');
});
