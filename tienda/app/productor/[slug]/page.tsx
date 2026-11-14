import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getProducerBySlug } from '@/lib/producers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Beat } from '@/lib/types';
import BeatCatalog from '../../components/BeatCatalog';

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

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

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
    <main>
      <header className="pstore-hero">
        <span className="pstore-avatar" aria-hidden="true">{initialsOf(producer.stageName)}</span>
        <div className="pstore-id">
          <p className="pstore-kicker">Productor en Lujo Urban</p>
          <h1 className="pstore-name">{producer.stageName}</h1>
          <p className="pstore-count">
            {beats.length === 0
              ? 'Tienda abierta'
              : `${available} ${available === 1 ? 'beat disponible' : 'beats disponibles'}`}
          </p>
        </div>
      </header>

      {error && <p className="beats-loading">No se pudieron cargar los beats.</p>}

      {!error && beats.length === 0 && (
        <section className="pstore-empty" aria-label="Tienda sin beats todavía">
          <h2 className="pstore-empty-title">Los primeros beats están por llegar</h2>
          <p className="pstore-empty-copy">
            {producer.stageName} ya tiene su tienda en Lujo Urban. Vuelve pronto para escuchar y licenciar sus beats.
          </p>
          <a className="pstore-empty-link" href="/">Ver todos los beats</a>
        </section>
      )}

      {!error && beats.length > 0 && <BeatCatalog beats={beats} />}
    </main>
  );
}
