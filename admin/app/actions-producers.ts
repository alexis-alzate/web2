'use server';

import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';

const requiredText = (formData: FormData, field: string, label: string) => {
  const value = formData.get(field);
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} es obligatorio.`);
  return value.trim();
};

const optionalText = (formData: FormData, field: string) => {
  const value = formData.get(field);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const createProducerAction = async (formData: FormData) => {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const stageName = requiredText(formData, 'stage_name', 'El nombre artistico');
  const email = requiredText(formData, 'email', 'El correo');
  const commissionRaw = formData.get('platform_commission_percent');
  const commission = commissionRaw ? Number(commissionRaw) : 30;

  if (!email.includes('@')) throw new Error('El correo del productor no es valido.');
  if (Number.isNaN(commission) || commission < 0 || commission > 100) {
    throw new Error('La comision LUJO URBAN debe estar entre 0 y 100.');
  }

  const { error } = await supabase.from('producers').insert({
    stage_name: stageName,
    email,
    platform_commission_percent: commission,
    notes: optionalText(formData, 'notes'),
    status: 'active'
  });

  if (error) throw new Error(`No se pudo crear el productor: ${error.message}`);
};

export const toggleProducerStatusAction = async (formData: FormData) => {
  await requireAdmin();
  const supabase = createSupabaseAdminClient();

  const id = requiredText(formData, 'id', 'El id del productor');
  const currentStatus = formData.get('status') === 'active' ? 'active' : 'inactive';
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

  const { error } = await supabase
    .from('producers')
    .update({ status: nextStatus })
    .eq('id', id);

  if (error) throw new Error(`No se pudo actualizar el productor: ${error.message}`);
};
