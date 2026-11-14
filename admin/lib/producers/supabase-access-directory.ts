// Implementacion del directorio de cuentas sobre Supabase Auth (service_role).
// Es lo unico de los accesos de productores que conoce `supabase.auth.admin`.

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AccessDirectory, AccessUser } from './types';

const toAccessUser = (user: User): AccessUser => ({
  id: user.id,
  email: user.email ?? null,
  confirmed: Boolean(user.email_confirmed_at),
  metadata: (user.app_metadata || {}) as Record<string, unknown>
});

export class SupabaseAccessDirectory implements AccessDirectory {
  constructor(private readonly client: () => SupabaseClient) {}

  async list(): Promise<AccessUser[]> {
    const { data, error } = await this.client().auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(`No pude revisar los accesos existentes: ${error.message}`);
    return data.users.map(toAccessUser);
  }

  async createInvite(email: string) {
    const { data, error } = await this.client().auth.admin.generateLink({ type: 'invite', email });
    if (error || !data.user) throw new Error(error?.message || 'No pude crear la invitación.');
    return { user: toAccessUser(data.user), tokenHash: data.properties.hashed_token };
  }

  async setMetadata(userId: string, metadata: Record<string, unknown>) {
    const { error } = await this.client().auth.admin.updateUserById(userId, { app_metadata: metadata });
    if (error) throw new Error(`No pude actualizar la cuenta: ${error.message}`);
  }

  async remove(userId: string) {
    const { error } = await this.client().auth.admin.deleteUser(userId);
    if (error) throw new Error(`No pude borrar la cuenta: ${error.message}`);
  }
}
