'use server';

import { revalidatePath } from 'next/cache';
import { safeAction } from '@/lib/actions/safe-action';
import { requireAdmin } from '@/lib/auth';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';
import { isWaitlistStatus } from '@/lib/waitlist';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cambia el estado de una solicitud de la lista de espera (nueva, contactado,
// aprobado, descartado). No crea accesos: aprobar aqui es solo una marca; la
// invitacion se sigue enviando desde "Accesos de artistas".
export const updateWaitlistStatusAction = safeAction(async (formData: FormData) => {
  await requireAdmin();

  const id = String(formData.get('id') || '');
  const status = formData.get('status');

  if (!UUID_PATTERN.test(id)) throw new ValidationError('Solicitud invalida.');
  if (!isWaitlistStatus(status)) throw new ValidationError('Estado no permitido.');

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('artist_waitlist')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw new Error(`No se pudo actualizar la solicitud: ${error.message}`);
  if (!data) throw new NotFoundError('Esa solicitud ya no existe.');

  revalidatePath('/');
});
