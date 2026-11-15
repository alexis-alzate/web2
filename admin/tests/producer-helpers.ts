// Dobles en memoria para probar ProducerAccessService sin Supabase ni Resend.

import { ProducerAccessService } from '@/lib/producers/access-service';
import type {
  AccessDirectory,
  AccessUser,
  InviteMailer,
  ProducerProfile,
  ProducerRepository
} from '@/lib/producers/types';

export const PRODUCER: ProducerProfile = {
  id: 'prod-1',
  stageName: 'Helmentt',
  slug: 'helmentt',
  email: 'helmentt@correo.com',
  commissionPercent: 15,
  status: 'active',
  bio: null,
  photoPath: null,
  payout: null
};

export class FakeDirectory implements AccessDirectory {
  users: AccessUser[] = [];
  calls: string[] = [];
  failSetMetadata = false;
  private nextId = 1;

  async list() {
    return this.users.map(user => ({ ...user, metadata: { ...user.metadata } }));
  }

  async createInvite(email: string) {
    const user: AccessUser = { id: `u${this.nextId++}`, email, confirmed: false, metadata: {} };
    this.users.push(user);
    this.calls.push(`createInvite:${email}`);
    return { user: { ...user }, tokenHash: `hash-${user.id}` };
  }

  async setMetadata(userId: string, metadata: Record<string, unknown>) {
    this.calls.push(`setMetadata:${userId}`);
    if (this.failSetMetadata) throw new Error('boom');
    const user = this.users.find(item => item.id === userId);
    if (user) user.metadata = { ...metadata };
  }

  async remove(userId: string) {
    this.calls.push(`remove:${userId}`);
    this.users = this.users.filter(user => user.id !== userId);
  }

  add(user: Partial<AccessUser> & { id: string }) {
    this.users.push({ email: null, confirmed: true, metadata: {}, ...user });
  }
}

export class FakeMailer implements InviteMailer {
  sent: Array<{ email: string; stageName: string; link: string; storeUrl: string | null }> = [];
  ready = true;
  failSend = false;

  assertReady() {
    if (!this.ready) throw new Error('correo sin configurar');
  }

  async send(input: { email: string; stageName: string; link: string; storeUrl: string | null }) {
    if (this.failSend) throw new Error('resend caido');
    this.sent.push(input);
  }
}

export const buildAccessService = (producer: ProducerProfile | null = PRODUCER) => {
  const directory = new FakeDirectory();
  const mailer = new FakeMailer();
  const repo: Pick<ProducerRepository, 'findById'> = {
    findById: async id => (producer && producer.id === id ? producer : null)
  };
  const service = new ProducerAccessService(
    repo,
    directory,
    mailer,
    async () => 'https://admin.lujourban.com',
    () => new Date('2026-11-14T12:00:00Z')
  );
  return { service, directory, mailer };
};
