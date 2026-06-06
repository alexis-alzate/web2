'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const getAppOrigin = async () => {
  const configuredUrl = process.env.ADMIN_SITE_URL || process.env.NEXT_PUBLIC_ADMIN_SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const headerStore = await headers();
  const host = headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') || 'https';
  if (!host) throw new Error('No pude determinar la URL del panel.');
  return `${protocol}://${host}`;
};

export const sendPasswordResetAction = async (formData: FormData) => {
  const email = String(formData.get('email') || '').trim();
  if (!email) redirect('/forgot-password?error=email');

  const supabase = await createSupabaseServerClient();
  const origin = await getAppOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`
  });

  if (error) redirect('/forgot-password?error=send');
  redirect('/forgot-password?sent=1');
};

export const updatePasswordAction = async (formData: FormData) => {
  const password = String(formData.get('password') || '');
  const confirmation = String(formData.get('confirmation') || '');

  if (password.length < 8) redirect('/reset-password?error=short');
  if (password !== confirmation) redirect('/reset-password?error=match');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/reset-password?error=session');

  await supabase.auth.signOut();
  redirect('/login?reset=1');
};
