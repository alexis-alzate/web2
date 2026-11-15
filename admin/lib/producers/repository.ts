// Unico archivo de productores que toca las tablas `producers`, `beats` y
// `producer_earnings`. Traduce filas de la base a los tipos de `types.ts`.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ValidationError } from '@/lib/errors';
import { earningPhase } from './earnings-summary';
import { isPayoutMethod } from './payout-rules';
import type {
  EarningRow,
  PayoutDetails,
  PayoutResult,
  PayoutRow,
  PendingTotal,
  ProducerBeat,
  ProducerProfile,
  ProducerRepository
} from './types';

type ProducerRow = {
  id: string;
  stage_name: string;
  slug: string | null;
  email: string;
  platform_commission_percent: number | string;
  status: ProducerProfile['status'];
  bio: string | null;
  photo_path: string | null;
  payout_method: string | null;
  payout_account: string | null;
  payout_holder: string | null;
};

type PayoutDbRow = {
  id: string;
  producer_id: string;
  amount: number;
  earnings_count: number;
  method: PayoutRow['method'];
  account: string;
  holder: string | null;
  reference: string;
  paid_by: string;
  paid_at: string;
  producers?: { stage_name: string } | { stage_name: string }[] | null;
};

type BeatRow = {
  id: string;
  slug: string;
  title: string;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  status: ProducerBeat['status'];
  cover_url: string | null;
  created_at: string;
};

type EarningDbRow = {
  id: string;
  license_type: EarningRow['license'];
  gross_amount: number;
  platform_fee_amount: number;
  producer_amount: number;
  status: EarningRow['status'];
  created_at: string;
  available_at: string;
  beats: { title: string } | { title: string }[] | null;
};

// La base garantiza que metodo y cuenta van juntos; el titular es obligatorio
// al guardar, pero puede faltar en filas viejas.
const toPayoutDetails = (row: ProducerRow): PayoutDetails | null => {
  if (!isPayoutMethod(row.payout_method) || !row.payout_account) return null;
  return { method: row.payout_method, account: row.payout_account, holder: row.payout_holder ?? '' };
};

const producerName = (value: PayoutDbRow['producers']) =>
  (Array.isArray(value) ? value[0]?.stage_name : value?.stage_name) ?? null;

const toPayoutRow = (row: PayoutDbRow): PayoutRow => ({
  id: row.id,
  producerId: row.producer_id,
  producerName: producerName(row.producers),
  amount: row.amount,
  earningsCount: row.earnings_count,
  method: row.method,
  account: row.account,
  holder: row.holder,
  reference: row.reference,
  paidBy: row.paid_by,
  paidAt: row.paid_at
});

const PAYOUT_COLUMNS = 'id, producer_id, amount, earnings_count, method, account, holder, reference, paid_by, paid_at';

const unexpected = (action: string, message: string) => new Error(`No pude ${action}: ${message}`);

const beatTitle = (beats: EarningDbRow['beats']) =>
  (Array.isArray(beats) ? beats[0]?.title : beats?.title) ?? null;

export class SupabaseProducerRepository implements ProducerRepository {
  constructor(private readonly client: () => SupabaseClient) {}

  async findById(id: string): Promise<ProducerProfile | null> {
    const { data, error } = await this.client()
      .from('producers')
      .select('id, stage_name, slug, email, platform_commission_percent, status, bio, photo_path, payout_method, payout_account, payout_holder')
      .eq('id', id)
      .maybeSingle();
    if (error) throw unexpected('leer al productor', error.message);
    if (!data) return null;

    const row = data as ProducerRow;
    return {
      id: row.id,
      stageName: row.stage_name,
      slug: row.slug,
      email: row.email,
      commissionPercent: Number(row.platform_commission_percent),
      status: row.status,
      bio: row.bio,
      photoPath: row.photo_path,
      payout: toPayoutDetails(row)
    };
  }

  async updateProfile(producerId: string, changes: { bio: string | null; photoPath: string | null }): Promise<void> {
    const { error } = await this.client()
      .from('producers')
      .update({ bio: changes.bio, photo_path: changes.photoPath })
      .eq('id', producerId);
    if (error) throw unexpected('guardar el perfil', error.message);
  }

  async listBeats(producerId: string): Promise<ProducerBeat[]> {
    const { data, error } = await this.client()
      .from('beats')
      .select('id, slug, title, bpm, key, genre, status, cover_url, created_at')
      .eq('producer_id', producerId)
      .order('created_at', { ascending: false });
    if (error) throw unexpected('leer los beats', error.message);

    return ((data || []) as BeatRow[]).map(row => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      bpm: row.bpm,
      key: row.key,
      genre: row.genre,
      status: row.status,
      coverPath: row.cover_url,
      createdAt: row.created_at
    }));
  }

  async listEarnings(producerId: string): Promise<EarningRow[]> {
    const { data, error } = await this.client()
      .from('producer_earnings')
      .select('id, license_type, gross_amount, platform_fee_amount, producer_amount, status, created_at, available_at, beats(title)')
      .eq('producer_id', producerId)
      .order('created_at', { ascending: false });
    if (error) throw unexpected('leer las ventas', error.message);

    return ((data || []) as unknown as EarningDbRow[]).map(row => ({
      id: row.id,
      beatTitle: beatTitle(row.beats),
      license: row.license_type,
      grossAmount: row.gross_amount,
      platformFeeAmount: row.platform_fee_amount,
      producerAmount: row.producer_amount,
      status: row.status,
      createdAt: row.created_at,
      availableAt: row.available_at
    }));
  }

  async updatePayoutDetails(producerId: string, details: PayoutDetails): Promise<void> {
    const { error } = await this.client()
      .from('producers')
      .update({
        payout_method: details.method,
        payout_account: details.account,
        payout_holder: details.holder
      })
      .eq('id', producerId);
    if (error) throw unexpected('guardar cómo cobrar', error.message);
  }

  async listPayouts(producerId: string): Promise<PayoutRow[]> {
    const { data, error } = await this.client()
      .from('producer_payouts')
      .select(PAYOUT_COLUMNS)
      .eq('producer_id', producerId)
      .order('paid_at', { ascending: false });
    if (error) throw unexpected('leer los pagos', error.message);
    return ((data || []) as PayoutDbRow[]).map(toPayoutRow);
  }

  async listRecentPayouts(limit: number): Promise<PayoutRow[]> {
    const { data, error } = await this.client()
      .from('producer_payouts')
      .select(`${PAYOUT_COLUMNS}, producers(stage_name)`)
      .order('paid_at', { ascending: false })
      .limit(limit);
    if (error) throw unexpected('leer los pagos', error.message);
    return ((data || []) as unknown as PayoutDbRow[]).map(toPayoutRow);
  }

  async pendingTotals(): Promise<Map<string, PendingTotal>> {
    const totals = new Map<string, PendingTotal>();
    const now = new Date();
    // Se leen por paginas: la API devuelve como maximo 1000 filas por consulta.
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.client()
        .from('producer_earnings')
        .select('id, producer_id, producer_amount, available_at')
        .eq('status', 'pending')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw unexpected('leer lo pendiente de pago', error.message);

      const rows = (data || []) as Array<{ producer_id: string; producer_amount: number; available_at: string }>;
      for (const row of rows) {
        const current = totals.get(row.producer_id) ?? {
          amount: 0,
          count: 0,
          availableAmount: 0,
          availableCount: 0,
          holdingAmount: 0,
          nextReleaseAt: null
        };
        const next: PendingTotal = {
          ...current,
          amount: current.amount + row.producer_amount,
          count: current.count + 1
        };
        if (earningPhase({ status: 'pending', availableAt: row.available_at }, now) === 'available') {
          next.availableAmount += row.producer_amount;
          next.availableCount += 1;
        } else {
          next.holdingAmount += row.producer_amount;
          if (!next.nextReleaseAt || row.available_at < next.nextReleaseAt) next.nextReleaseAt = row.available_at;
        }
        totals.set(row.producer_id, next);
      }
      if (rows.length < PAGE) break;
    }
    return totals;
  }

  async registerPayout(input: {
    producerId: string;
    reference: string;
    paidBy: string;
    expectedAccount: string;
    minAmount: number;
  }): Promise<PayoutResult> {
    const { data, error } = await this.client().rpc('register_producer_payout', {
      p_producer_id: input.producerId,
      p_reference: input.reference,
      p_paid_by: input.paidBy,
      p_expected_account: input.expectedAccount,
      p_min_amount: input.minAmount
    });

    if (error) {
      // Los mensajes que empiezan con "LU:" estan escritos para el admin.
      const match = /LU:\s*(.+)/.exec(error.message);
      if (match) throw new ValidationError(match[1].trim());
      throw unexpected('registrar el pago', error.message);
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { out_payout_id: string; out_amount: number; out_count: number }
      | null
      | undefined;
    if (!row) throw unexpected('registrar el pago', 'la base no devolvió el pago');

    return { payoutId: row.out_payout_id, amount: row.out_amount, earningsCount: row.out_count };
  }
}
