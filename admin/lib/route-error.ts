// Traductor de errores para rutas API (Route Handlers). Es el hermano de
// `safeAction` (lib/actions/safe-action.ts), que hace lo mismo para Server
// Actions: los errores con tipo se muestran con su estado HTTP; cualquier otro
// se registra completo en el servidor y el cliente recibe un mensaje generico.

import { NextResponse } from 'next/server';
import { isAppError } from '@/lib/errors';
import { GENERIC_ERROR_MESSAGE } from '@/lib/actions/safe-action';

export const errorResponse = (error: unknown): NextResponse => {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }

  console.error('[route] error inesperado:', error);
  return NextResponse.json(
    { error: GENERIC_ERROR_MESSAGE, code: 'INTERNAL' },
    { status: 500, headers: { 'Cache-Control': 'private, no-store' } }
  );
};
