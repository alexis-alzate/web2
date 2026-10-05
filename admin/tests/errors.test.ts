import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PublishError,
  UnauthorizedError,
  ValidationError,
  isAppError
} from '@/backend/core/errors';

// Cada error lleva un codigo y un estado, igual que las excepciones de la API
// de Java (ArtistValidationException = 400, DuplicateArtistException = 409).
describe('errores con tipo', () => {
  it.each([
    ['ValidationError', new ValidationError('dato malo'), 'VALIDATION', 400],
    ['UnauthorizedError', new UnauthorizedError(), 'UNAUTHORIZED', 401],
    ['ForbiddenError', new ForbiddenError(), 'FORBIDDEN', 403],
    ['NotFoundError', new NotFoundError('no existe'), 'NOT_FOUND', 404],
    ['ConflictError', new ConflictError('duplicado'), 'CONFLICT', 409],
    ['PublishError', new PublishError('fallo GitHub'), 'PUBLISH_FAILED', 502]
  ])('%s tiene el codigo y el estado correctos', (name, error, code, status) => {
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.name).toBe(name);
  });

  it('todos son AppError y tambien Error', () => {
    const error = new ConflictError('x');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('conservan el mensaje que se les da', () => {
    expect(new ValidationError('El nombre es obligatorio.').message).toBe('El nombre es obligatorio.');
  });

  it('los de sesion y permiso traen mensaje por defecto para personas', () => {
    expect(new UnauthorizedError().message).toMatch(/sesion/i);
    expect(new ForbiddenError().message).toMatch(/permiso/i);
  });

  it('guardan la causa original cuando se les pasa', () => {
    const cause = new Error('23505 de Postgres');
    expect(new ConflictError('duplicado', { cause }).cause).toBe(cause);
    expect(new PublishError('fallo', { cause }).cause).toBe(cause);
  });

  describe('isAppError', () => {
    it('reconoce los errores propios', () => {
      expect(isAppError(new NotFoundError('x'))).toBe(true);
    });

    it('no confunde un Error normal, un texto ni null', () => {
      expect(isAppError(new Error('x'))).toBe(false);
      expect(isAppError('texto')).toBe(false);
      expect(isAppError(null)).toBe(false);
    });
  });
});
