// Reglas del acceso de los productores: a quien se puede invitar, que pasa si
// el correo ya existe, y como se pausa o desvincula una cuenta. No sabe de
// Supabase ni de Resend: recibe el directorio de cuentas, el repositorio y el
// correo por constructor, asi que se prueba con dobles en memoria.
//
// Cada productor tiene a lo sumo UNA cuenta, y un correo pertenece a un solo
// tipo de acceso (admin, artista o productor).

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { producerStoreUrl } from './store-url';
import { linkedProducerId, PRODUCER_ROLE, producerMetadata, unlinkedProducerMetadata } from './access-metadata';
import type {
  AccessDirectory,
  AccessStatus,
  AccessUser,
  InviteMailer,
  ProducerAccessInfo,
  ProducerRepository
} from './types';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export type InviteResult = { kind: 'invited' | 'relinked'; email: string };

export class ProducerAccessService {
  constructor(
    private readonly producers: Pick<ProducerRepository, 'findById'>,
    private readonly directory: AccessDirectory,
    private readonly mailer: InviteMailer,
    private readonly resolveOrigin: () => Promise<string>,
    private readonly now: () => Date = () => new Date(),
    private readonly storeUrlFor: (slug: string) => string = slug => producerStoreUrl(slug)
  ) {}

  async invite(producerId: string, rawEmail: string): Promise<InviteResult> {
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) throw new ValidationError('El correo no es válido.');

    const producer = await this.producers.findById(producerId);
    if (!producer) throw new NotFoundError('No encontré a ese productor.');
    if (producer.status !== 'active') {
      throw new ValidationError('Activa al productor antes de darle acceso.');
    }

    const users = await this.directory.list();
    const taken = users.find(user => linkedProducerId(user.metadata) === producerId);
    if (taken) {
      throw new ConflictError(
        `Este productor ya tiene un correo vinculado (${taken.email || 'sin correo'}). Desvincúlalo antes de asignar otro.`
      );
    }

    const existing = users.find(user => user.email?.toLowerCase() === email);
    if (existing) {
      if (existing.metadata.lujo_role !== PRODUCER_ROLE) {
        throw new ConflictError('Ese correo ya pertenece a otra clase de acceso del panel. Usa un correo diferente.');
      }
      if (linkedProducerId(existing.metadata)) {
        throw new ConflictError('Ese correo ya está vinculado a otro productor. Desvincúlalo primero.');
      }
      if (existing.confirmed) {
        await this.directory.setMetadata(existing.id, producerMetadata(existing.metadata, producerId, 'active'));
        await this.assertSingleLink(producerId, existing.id, existing.metadata);
        return { kind: 'relinked', email };
      }
      // Invitacion anterior que nunca se uso: se renueva con un enlace nuevo.
      await this.directory.remove(existing.id);
    }

    this.mailer.assertReady();
    const origin = await this.resolveOrigin();
    const { user, tokenHash } = await this.directory.createInvite(email);

    try {
      await this.directory.setMetadata(user.id, producerMetadata(user.metadata, producerId, 'active'));
    } catch {
      await this.discard(user.id);
      throw new ConflictError('La invitación no pudo vincularse. Intenta otra vez.');
    }

    if ((await this.linkedUsers(producerId)).length > 1) {
      await this.discard(user.id);
      throw new ConflictError('Otro acceso ocupó este perfil al mismo tiempo. No se creó una cuenta duplicada.');
    }

    const link = new URL('/auth/confirm', origin);
    link.searchParams.set('token_hash', tokenHash);
    link.searchParams.set('type', 'invite');
    link.searchParams.set('next', '/reset-password');

    try {
      await this.mailer.send({
        email,
        stageName: producer.stageName,
        link: link.toString(),
        // Su tienda existe desde que se crea el productor, tenga beats o no.
        storeUrl: producer.slug ? this.storeUrlFor(producer.slug) : null
      });
    } catch (error) {
      await this.discard(user.id);
      throw error;
    }

    return { kind: 'invited', email };
  }

  async setStatus(userId: string, status: AccessStatus): Promise<void> {
    const user = await this.requireProducerUser(userId);
    await this.directory.setMetadata(user.id, { ...user.metadata, lujo_access: status });
  }

  // Suelta el correo del productor para poder asignar otro. Si la persona nunca
  // creo su clave, la cuenta pendiente se borra; si ya la tenia, se conserva
  // sin acceso.
  async unlink(userId: string): Promise<void> {
    const user = await this.requireProducerUser(userId);
    if (!user.confirmed) {
      await this.directory.remove(user.id);
      return;
    }
    await this.directory.setMetadata(user.id, unlinkedProducerMetadata(user.metadata, this.now()));
  }

  // productorId -> su cuenta, para mostrarla en el panel.
  async listAccess(): Promise<Map<string, ProducerAccessInfo>> {
    const result = new Map<string, ProducerAccessInfo>();
    for (const user of await this.directory.list()) {
      const producerId = linkedProducerId(user.metadata);
      if (!producerId) continue;
      const status = user.metadata.lujo_access;
      result.set(producerId, {
        userId: user.id,
        email: user.email,
        status: status === 'active' || status === 'suspended' ? status : 'inactive',
        confirmed: user.confirmed
      });
    }
    return result;
  }

  private async requireProducerUser(userId: string): Promise<AccessUser> {
    const user = (await this.directory.list()).find(item => item.id === userId);
    if (!user) throw new NotFoundError('No encontré esa cuenta.');
    if (user.metadata.lujo_role !== PRODUCER_ROLE) {
      throw new ForbiddenError('Por seguridad, esta acción solo modifica cuentas de productores.');
    }
    return user;
  }

  private async linkedUsers(producerId: string) {
    return (await this.directory.list()).filter(user => linkedProducerId(user.metadata) === producerId);
  }

  private async assertSingleLink(producerId: string, userId: string, previous: Record<string, unknown>) {
    if ((await this.linkedUsers(producerId)).length <= 1) return;
    await this.directory.setMetadata(userId, previous);
    throw new ConflictError('Otro acceso ocupó este perfil al mismo tiempo. El correo anterior quedó sin vincular.');
  }

  private async discard(userId: string) {
    await this.directory.remove(userId).catch(() => null);
  }
}
