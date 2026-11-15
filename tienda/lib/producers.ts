import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Lectura publica de la ficha de un productor para su pagina de tienda.
//
// La tabla `producers` tiene RLS sin politicas (guarda correo y comision, que
// NUNCA deben salir), asi que el cliente anonimo no la puede leer. Por eso este
// helper usa el cliente de servicio, pero pide SOLO las columnas de abajo y solo
// productores activos: no ampliar el `select` sin pensar que se vuelve publico.
// `bio` y `photo_path` son publicos a proposito: es lo que el productor pone en
// su tienda (migracion 024).

export type PublicProducer = {
  id: string;
  slug: string;
  stageName: string;
  // Descripcion corta (max. 160 caracteres) y ruta de su foto; null = no puso.
  bio: string | null;
  photoPath: string | null;
};

// Los slugs son minusculas, numeros y guiones (lo garantiza la base). Cortar
// aqui lo que no lo cumpla evita consultas inutiles con basura de la URL.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function getProducerBySlug(slug: string): Promise<PublicProducer | null> {
  if (!SLUG_PATTERN.test(slug) || slug.length > 60) return null;

  const { data, error } = await createSupabaseAdminClient()
    .from('producers')
    .select('id, slug, stage_name, bio, photo_path')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { id: string; slug: string; stage_name: string; bio: string | null; photo_path: string | null };
  return { id: row.id, slug: row.slug, stageName: row.stage_name, bio: row.bio, photoPath: row.photo_path };
}

// Slugs de varios productores a la vez, para enlazar "Prod. by X" desde los
// beats. Mismo criterio que arriba: SOLO `id, slug` y solo productores activos
// (nunca correo ni comision). Un productor pausado queda sin enlace.
export async function getProducerSlugs(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const slugs = new Map<string, string>();
  if (unique.length === 0) return slugs;

  const { data, error } = await createSupabaseAdminClient()
    .from('producers')
    .select('id, slug')
    .in('id', unique)
    .eq('status', 'active');

  if (error || !data) return slugs;
  for (const row of data as { id: string; slug: string }[]) {
    if (SLUG_PATTERN.test(row.slug)) slugs.set(row.id, row.slug);
  }
  return slugs;
}

// Devuelve los beats con `producer_slug` puesto cuando su productor tiene tienda.
export async function withProducerSlugs<T extends { producer_id: string | null }>(
  beats: T[]
): Promise<(T & { producer_slug: string | null })[]> {
  const slugs = await getProducerSlugs(
    beats.map((beat) => beat.producer_id).filter((id): id is string => !!id)
  );
  return beats.map((beat) => ({
    ...beat,
    producer_slug: beat.producer_id ? (slugs.get(beat.producer_id) ?? null) : null
  }));
}
