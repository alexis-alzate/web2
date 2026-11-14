import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProducerBySlug } from '@/lib/producers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Beat } from '@/lib/types';
import BeatCatalog from '../../components/BeatCatalog';
import ProducerStoreEmpty from '../../components/producer-store/ProducerStoreEmpty';
import ProducerStoreHero from '../../components/producer-store/ProducerStoreHero';

// Tienda publica de un productor: tienda.lujourban.com/productor/<slug>.
// Existe desde que el productor se crea, tenga beats o no.

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const producer = await getProducerBySlug(slug);
  if (!producer) return {};

  const description = `Beats de ${producer.stageName} en Lujo Urban. Licencias básica, premium y exclusiva con descarga inmediata.`;
  return {
    title: `${producer.stageName} — Tienda de Beats Lujo Urban`,
    description,
    openGraph: { title: `${producer.stageName} — Lujo Urban`, description }
  };
}

export default async function ProducerStorePage({ params }: PageProps) {
  const { slug } = await params;
  const producer = await getProducerBySlug(slug);
  if (!producer) notFound();

  const { data, error } = await createSupabaseServerClient()
    .from('beats')
    .select('*')
    .eq('producer_id', producer.id)
    .order('created_at', { ascending: false });

  // Todos los beats de esta pagina son del mismo productor: el slug ya se conoce.
  const beats: Beat[] = error
    ? []
    : ((data as Beat[]) ?? []).map((beat) => ({ ...beat, producer_slug: producer.slug }));
  const available = beats.filter((beat) => beat.status === 'available').length;

  return (
    <main className="pstore-page">
      <ProducerStoreHero slug={producer.slug} stageName={producer.stageName} availableCount={available} />

      {error && <p className="beats-loading">No se pudieron cargar los beats.</p>}
      {!error && beats.length === 0 && <ProducerStoreEmpty stageName={producer.stageName} />}
      {!error && beats.length > 0 && <BeatCatalog beats={beats} />}
    </main>
  );
}
