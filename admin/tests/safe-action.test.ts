import { notFound, redirect } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import { GENERIC_ERROR_MESSAGE, safeAction, toFailure } from '@/backend/core/safe-action';
import { ConflictError, ValidationError } from '@/backend/core/errors';

// safeAction es el equivalente de @RestControllerAdvice: atrapa los errores
// con tipo y los convierte en { ok: false, code, message }.
describe('safeAction', () => {
  it('devuelve ok con el resultado cuando todo sale bien', async () => {
    const action = safeAction(async (a: number, b: number) => a + b);

    await expect(action(2, 3)).resolves.toEqual({ ok: true, data: 5 });
  });

  it('pasa los argumentos tal cual a la action', async () => {
    const inner = vi.fn(async (_form: string, _id: number) => undefined);

    await safeAction(inner)('formulario', 7);

    expect(inner).toHaveBeenCalledWith('formulario', 7);
  });

  it('un error con tipo se muestra tal cual, con su codigo y mensaje', async () => {
    const action = safeAction(async () => {
      throw new ConflictError('Ya existe un artista con ese slug.');
    });

    await expect(action()).resolves.toEqual({
      ok: false,
      code: 'CONFLICT',
      message: 'Ya existe un artista con ese slug.'
    });
  });

  it('distingue validacion de conflicto por el codigo', async () => {
    const validation = await safeAction(async () => {
      throw new ValidationError('mal');
    })();

    expect(validation).toMatchObject({ ok: false, code: 'VALIDATION' });
  });

  describe('errores inesperados', () => {
    it('el usuario recibe un mensaje generico y nunca el detalle interno', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const action = safeAction(async () => {
        throw new Error('connection to db.internal:5432 refused, password=secreto');
      });

      const result = await action();

      expect(result).toEqual({ ok: false, code: 'INTERNAL', message: GENERIC_ERROR_MESSAGE });
      expect(JSON.stringify(result)).not.toContain('secreto');
      expect(JSON.stringify(result)).not.toContain('5432');
    });

    it('el error completo se registra en el servidor', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const boom = new Error('algo se rompio');

      await safeAction(async () => {
        throw boom;
      })();

      expect(spy).toHaveBeenCalledWith(expect.stringContaining('error inesperado'), boom);
    });

    it('un error con tipo NO se registra como inesperado', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await safeAction(async () => {
        throw new ValidationError('mal');
      })();

      expect(spy).not.toHaveBeenCalled();
    });

    it('lo que no es un Error (un texto lanzado) tambien da el mensaje generico', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await safeAction(async () => {
        throw 'texto suelto';
      })();

      expect(result).toMatchObject({ ok: false, code: 'INTERNAL', message: GENERIC_ERROR_MESSAGE });
    });
  });

  // redirect() y notFound() de Next funcionan LANZANDO una excepcion
  // especial. Si safeAction se la tragara, la redireccion nunca ocurriria.
  describe('redirect() y notFound() de Next', () => {
    it('redirect() atraviesa safeAction y no se convierte en error', async () => {
      const action = safeAction(async () => {
        redirect('/login');
      });

      await expect(action()).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') });
    });

    it('notFound() atraviesa safeAction y no se convierte en error', async () => {
      const action = safeAction(async () => {
        notFound();
      });

      await expect(action()).rejects.toMatchObject({ digest: expect.stringContaining('404') });
    });
  });
});

describe('toFailure', () => {
  it('traduce un error con tipo sin registrar nada', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(toFailure(new ValidationError('mal'))).toEqual({ ok: false, code: 'VALIDATION', message: 'mal' });
    expect(spy).not.toHaveBeenCalled();
  });
});
