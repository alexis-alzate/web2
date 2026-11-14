// Reglas de las solicitudes de productor: recibir una, aprobarla o rechazarla.
// No sabe de Supabase ni de Resend: recibe el repositorio, el registro de
// productores y el invitador por constructor, asi que se prueba con dobles.
//
// Aprobar crea la ficha del productor y le envia la invitacion para crear su
// clave. Si cualquier paso falla, todo se deshace y la solicitud queda otra
// vez "por revisar" para reintentar; nunca queda un productor a medias.

import { ConflictError, NotFoundError, RateLimitError } from '@/lib/errors';
import { parseApplication, parseCommission } from './rules';
import type { ApplicationRepository, ProducerApplication, ProducerInviter, ProducerRegistry } from './types';

export const MAX_APPLICATIONS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export class ProducerApplicationService {
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly registry: ProducerRegistry,
    private readonly inviter: ProducerInviter,
    private readonly now: () => Date = () => new Date()
  ) {}

  // Guarda una solicitud del formulario publico. Repetir el correo no crea otra
  // fila y, para quien llena el formulario, tambien es un exito.
  async submit(body: unknown, sourceUrl: string | null): Promise<'created' | 'duplicate'> {
    const input = parseApplication(body);

    const since = new Date(this.now().getTime() - HOUR_MS).toISOString();
    if ((await this.applications.countSince(since)) >= MAX_APPLICATIONS_PER_HOUR) {
      throw new RateLimitError();
    }

    return this.applications.insert(input, sourceUrl);
  }

  list(): Promise<ProducerApplication[]> {
    return this.applications.list();
  }

  async approve(id: string, rawCommission: unknown): Promise<void> {
    const commissionPercent = parseCommission(rawCommission);
    const application = await this.requireApplication(id);

    if (!(await this.applications.claim(id))) {
      throw new ConflictError('Esta solicitud ya fue revisada.');
    }

    let producerId: string | null = null;
    try {
      producerId = await this.registry.create({
        stageName: application.stageName,
        email: application.email,
        commissionPercent
      });
      await this.inviter.invite(producerId, application.email);
      await this.applications.attachProducer(id, producerId);
    } catch (error) {
      if (producerId) await this.registry.remove(producerId).catch(() => null);
      await this.applications.release(id).catch(() => null);
      throw error;
    }
  }

  async reject(id: string): Promise<void> {
    await this.requireApplication(id);
    if (!(await this.applications.reject(id))) {
      throw new ConflictError('Esta solicitud ya fue revisada.');
    }
  }

  private async requireApplication(id: string): Promise<ProducerApplication> {
    const application = await this.applications.findById(id);
    if (!application) throw new NotFoundError('Esa solicitud ya no existe.');
    if (application.status !== 'new') throw new ConflictError('Esta solicitud ya fue revisada.');
    return application;
  }
}
