import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/server';
import { CONFIRM_FAILURE_PATH, parseConfirmRequest } from '@/lib/auth-confirm';

// Controlador delgado: lee el formulario, valida el enlace con Supabase y
// manda a la persona a su destino. Las reglas estan en lib/auth-confirm.ts.
// Se responde 303 para que el navegador pase de POST a GET al redirigir.
export async function POST(request: Request) {
  const form = await request.formData();
  const confirm = parseConfirmRequest(name => {
    const value = form.get(name);
    return typeof value === 'string' ? value : null;
  });

  const failure = () => NextResponse.redirect(new URL(CONFIRM_FAILURE_PATH, request.url), 303);
  if (!confirm) return failure();

  const response = NextResponse.redirect(new URL(confirm.next, request.url), 303);
  const supabase = createSupabaseRouteClient(request, response);
  const { error } = await supabase.auth.verifyOtp({
    type: confirm.type,
    token_hash: confirm.tokenHash
  });

  return error ? failure() : response;
}
