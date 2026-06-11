import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Beat } from '@/lib/types';
import BeatCatalog from './components/BeatCatalog';

export const revalidate = 60;

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from('beats')
    .select('*')
    .order('created_at', { ascending: false });

  let beats: Beat[] = error ? [] : (data as Beat[]);

  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'show_demo_beats')
    .maybeSingle();
  const showDemoBeats = setting?.value !== false;

  // TEMPORAL: duplicar el catálogo para previsualizar la vitrina llena.
  // Se desactiva desde el panel admin (Tienda de beats > "Ocultar beats de prueba").
  if (showDemoBeats && beats.length) {
    const base = beats[0];
    const genres = ['Afrobeat', 'Reggaeton', 'Dancehall', 'Trap', 'Afro Pop'];
    const tagSets = [
      ['afro dancehall', 'Beele Type Beat'],
      ['reggaeton sad', 'Omah Lay Type Beat'],
      ['type beat', 'Sech Type Beat'],
      ['afro pop', 'Karol G Type Beat'],
      ['trap latino', 'Feid Type Beat']
    ];
    const demo = Array.from({ length: 19 }, (_, i) => ({
      ...base,
      id: `${base.id}-demo-${i}`,
      title: `${base.title} ${i + 2}`,
      genre: genres[i % genres.length],
      tags: tagSets[i % tagSets.length],
      bpm: 80 + ((i + 1) * 3) % 60
    }));
    beats = [...beats, ...demo];
  }

  if (q) {
    const term = q.toLowerCase();
    beats = beats.filter((b) =>
      b.title.toLowerCase().includes(term)
      || (b.genre ?? '').toLowerCase().includes(term)
      || (b.tags ?? []).some((t) => t.toLowerCase().includes(term))
    );
  }

  return (
    <main>
      {error && <p className="beats-loading">No se pudieron cargar los beats.</p>}
      {!error && <BeatCatalog beats={beats} />}
    </main>
  );
}
