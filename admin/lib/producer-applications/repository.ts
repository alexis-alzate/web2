// Unico archivo que toca la tabla `producer_applications` y crea filas en
// `producers` al aprobar. Traduce filas de la base a los tipos de `types.ts`.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationInput, ApplicationStatus } from './rules';
import type { ApplicationRepository, ProducerApplication, ProducerRegistry } from './types';

const UNIQUE_VIOLATION = '23505';

type Row = {
  id: string;
  stage_name: string;
  email: string;
  music_url: string;
  status: ApplicationStatus;
  producer_id: string | null;
  created_at: string;
};

const COLUMNS = 'id, stage_name, email, music_url, status, producer_id, created_at';

const toApplication = (row: Row): ProducerApplication => ({
  id: row.id,
  stageName: row.stage_name,
  email: row.email,
  musicUrl: row.music_url,
  status: row.status,
  producerId: row.producer_id,
  createdAt: row.created_at
});

const unexpected = (action: string, message: string) => new Error(`No pude ${action}: ${message}`);

export class SupabaseApplicationRepository implements ApplicationRepository {
  constructor(private readonly client: () => SupabaseClient) {}

  async insert(input: ApplicationInput, sourceUrl: string | null) {
    const { error } = await this.client().from('producer_applications').insert({
      stage_name: input.stageName,
      email: input.email,
      music_url: input.musicUrl,
      source_url: sourceUrl
    });
    if (!error) return 'created' as const;
    if (error.code === UNIQUE_VIOLATION) return 'duplicate' as const;
    throw unexpected('guardar la solicitud', error.message);
  }

  async countSince(sinceIso: string) {
    const { count, error } = await this.client()
      .from('producer_applications')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sinceIso);
    if (error) throw unexpected('contar las solicitudes', error.message);
    return count ?? 0;
  }

  async findById(id: string) {
    const { data, error } = await this.client()
      .from('producer_applications')
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw unexpected('leer la solicitud', error.message);
    return data ? toApplication(data as Row) : null;
  }

  async list() {
    const { data, error } = await this.client()
      .from('producer_applications')
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw unexpected('leer las solicitudes', error.message);
    return ((data as Row[]) || []).map(toApplication);
  }

  async claim(id: string) {
    return this.transition(id, 'new', { status: 'approved', reviewed_at: new Date().toISOString() });
  }

  async release(id: string) {
    await this.transition(id, 'approved', { status: 'new', reviewed_at: null, producer_id: null });
  }

  async attachProducer(id: string, producerId: string) {
    const { error } = await this.client()
      .from('producer_applications')
      .update({ producer_id: producerId })
      .eq('id', id);
    if (error) throw unexpected('vincular el productor a la solicitud', error.message);
  }

  async reject(id: string) {
    return this.transition(id, 'new', { status: 'rejected', reviewed_at: new Date().toISOString() });
  }

  // UPDATE ... WHERE status = <esperado>: si otra persona ya cambio el estado,
  // no toca ninguna fila y devuelve false.
  private async transition(id: string, from: ApplicationStatus, changes: Record<string, unknown>) {
    const { data, error } = await this.client()
      .from('producer_applications')
      .update(changes)
      .eq('id', id)
      .eq('status', from)
      .select('id');
    if (error) throw unexpected('actualizar la solicitud', error.message);
    return (data?.length ?? 0) > 0;
  }
}

export class SupabaseProducerRegistry implements ProducerRegistry {
  constructor(private readonly client: () => SupabaseClient) {}

  async create(input: { stageName: string; email: string; commissionPercent: number }) {
    const { data, error } = await this.client()
      .from('producers')
      .insert({
        stage_name: input.stageName,
        email: input.email,
        platform_commission_percent: input.commissionPercent,
        status: 'active'
      })
      .select('id')
      .single();
    if (error || !data) throw unexpected('crear al productor', error?.message ?? 'sin respuesta');
    return (data as { id: string }).id;
  }

  async remove(id: string) {
    const { error } = await this.client().from('producers').delete().eq('id', id);
    if (error) throw unexpected('deshacer la creación del productor', error.message);
  }
}
