// Errores de la aplicacion, con tipo. Es el equivalente a las excepciones
// propias de una API de Java (ArtistValidationException, DuplicateArtist...).
//
// Quien detecta el problema (repositorio, servicio, auth) lanza el error que
// corresponde. Quien lo traduce para el usuario es UN solo lugar:
// lib/actions/safe-action.ts (el equivalente al @RestControllerAdvice).
//
// `status` usa los mismos numeros que HTTP para que el significado sea
// familiar y quede alineado con la API de Java; las Server Actions no los
// envian por la red, solo los usan para describir el error.

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PUBLISH_FAILED'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

// Dato mal formado o que incumple una regla (400).
export class ValidationError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('VALIDATION', 400, message, options);
  }
}

// No hay sesion (401).
export class UnauthorizedError extends AppError {
  constructor(message = 'Tu sesion expiro. Inicia de nuevo.') {
    super('UNAUTHORIZED', 401, message);
  }
}

// Hay sesion pero no permiso (403).
export class ForbiddenError extends AppError {
  constructor(message = 'No tienes permiso para realizar esta accion.') {
    super('FORBIDDEN', 403, message);
  }
}

// El recurso no existe (404).
export class NotFoundError extends AppError {
  constructor(message: string) {
    super('NOT_FOUND', 404, message);
  }
}

// El recurso ya existe o cambio mientras se editaba (409).
export class ConflictError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('CONFLICT', 409, message, options);
  }
}

// Los datos se guardaron pero no se pudo publicar el sitio (502).
export class PublishError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('PUBLISH_FAILED', 502, message, options);
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
