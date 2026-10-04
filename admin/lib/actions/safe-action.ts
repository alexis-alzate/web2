// Traductor central de errores para Server Actions: el equivalente al
// @RestControllerAdvice + @ExceptionHandler de Spring.
//
// Las capas de abajo LANZAN errores con tipo (lib/errors.ts). Aqui se
// atrapan en un solo lugar y se convierten en una respuesta uniforme:
//
//   { ok: true,  data? }
//   { ok: false, code, message }
//
// Se devuelve en vez de lanzar porque Next.js, en produccion, oculta el texto
// de los errores lanzados desde una Server Action: el usuario veria un mensaje
// generico y nunca el motivo real ("ese slug ya existe", "guardado pero no
// publicado"...). Un valor devuelto siempre llega completo.

import { unstable_rethrow } from 'next/navigation';
import { isAppError, type ErrorCode } from '@/lib/errors';

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; code: ErrorCode; message: string };

export const GENERIC_ERROR_MESSAGE = 'Ocurrio un error inesperado. Intenta de nuevo en un momento.';

// Convierte cualquier error en la respuesta que ve el usuario.
//  - Errores nuestros (AppError): se muestran tal cual, su mensaje ya es para personas.
//  - Cualquier otro: se registra completo en el servidor (logs de Vercel) y el
//    usuario recibe un mensaje generico, sin detalles internos.
export const toFailure = (error: unknown): Extract<ActionResult, { ok: false }> => {
  if (isAppError(error)) {
    return { ok: false, code: error.code, message: error.message };
  }

  console.error('[server-action] error inesperado:', error);
  return { ok: false, code: 'INTERNAL', message: GENERIC_ERROR_MESSAGE };
};

export const safeAction = <Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>
) => async (...args: Args): Promise<ActionResult<Result>> => {
  try {
    return { ok: true, data: await action(...args) };
  } catch (error) {
    // redirect() y notFound() de Next funcionan lanzando errores especiales:
    // no son fallos y hay que dejarlos pasar.
    unstable_rethrow(error);
    return toFailure(error);
  }
};
