import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { errorResponse } from '@/lib/route-error';

afterEach(() => vi.restoreAllMocks());

describe('errorResponse', () => {
  it('muestra los errores con tipo con su estado y su mensaje', async () => {
    const forbidden = errorResponse(new ForbiddenError('Sin permiso.'));
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: 'Sin permiso.', code: 'FORBIDDEN' });

    expect(errorResponse(new NotFoundError('No existe.')).status).toBe(404);
    expect(errorResponse(new ValidationError('Mal.')).status).toBe(400);
  });

  it('no guarda en caché las respuestas de error', () => {
    expect(errorResponse(new ForbiddenError()).headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('oculta el detalle de los errores inesperados y lo registra', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = errorResponse(new Error('password=secreto'));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('secreto');
    expect(log).toHaveBeenCalledOnce();
  });
});
