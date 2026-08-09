'use server';

import { redirect } from 'next/navigation';
import { getAppOrigin } from '@/lib/app-origin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
