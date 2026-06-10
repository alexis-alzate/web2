import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Beat } from '@/lib/types';
import { publicUrl } from '@/lib/format';
import BeatDetail from '../components/BeatDetail';

export const revalidate = 60;

async function getBeat(slug: string): Promise<Beat | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from('beats').select('*').eq('slug', slug).single();
  if (error || !data) return null;
  return data as Beat;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const beat = await getBeat(slug);
  if (!beat) return {};

  const meta = [beat.genre, beat.bpm ? `${beat.bpm} BPM` : null, beat.key, ...(beat.tags ?? [])]
    .filter(Boolean)
    .join(', ');

  const description = `Compra el beat "${beat.title}" — ${meta}. Licencias básica, premium y exclusiva con descarga inmediata.`;

  return {
    title: `${beat.title} — Tienda de Beats Lujo Urban`,
    description,
    openGraph: {
      title: beat.title,
      description,
      images: beat.cover_url ? [publicUrl('beats-covers', beat.cover_url)] : []
    }
  };
}

export default async function BeatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const beat = await getBeat(slug);
  if (!beat) notFound();

  return (
    <main>
      <BeatDetail beat={beat} />
    </main>
  );
}
