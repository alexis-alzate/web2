// Unico archivo de productores que toca las tablas `producers`, `beats` y
// `producer_earnings`. Traduce filas de la base a los tipos de `types.ts`.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { EarningRow, ProducerBeat, ProducerProfile, ProducerRepository } from './types';

type ProducerRow = {
  id: string;
  stage_name: string;
  slug: string | null;
  email: string;
  platform_commission_percent: number | string;
  status: ProducerProfile['status'];
  bio: string | null;
  photo_path: string | null;
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
  beats: { title: string } | { title: string }[] | null;
};

const unexpected = (action: string, message: string) => new Error(`No pude ${action}: ${message}`);

const beatTitle = (beats: EarningDbRow['beats']) =>
  (Array.isArray(beats) ? beats[0]?.title : beats?.title) ?? null;

export class SupabaseProducerRepository implements ProducerRepository {
  constructor(private readonly client: () => SupabaseClient) {}

  async findById(id: string): Promise<ProducerProfile | null> {
    const { data, error } = await this.client()
      .from('producers')
      .select('id, stage_name, slug, email, platform_commission_percent, status, bio, photo_path')
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
      photoPath: row.photo_path
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
      .select('id, license_type, gross_amount, platform_fee_amount, producer_amount, status, created_at, beats(title)')
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
      createdAt: row.created_at
    }));
  }
}
