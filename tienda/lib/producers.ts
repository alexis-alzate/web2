import { createSupabaseAdminClient } from "@/lib/supabase/server";

// Lectura publica de la ficha de un productor para su pagina de tienda.
//
// La tabla `producers` tiene RLS sin politicas (guarda correo y comision, que
// NUNCA deben salir), asi que el cliente anonimo no la puede leer. Por eso este
// helper usa el cliente de servicio, pero pide SOLO tres columnas y solo
// productores activos: no ampliar el `select` sin pensar que se vuelve publico.

export type PublicProducer = {
  id: string;
  slug: string;
  stageName: string;
};

// Los slugs son minusculas, numeros y guiones (lo garantiza la base). Cortar
// aqui lo que no lo cumpla evita consultas inutiles con basura de la URL.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function getProducerBySlug(slug: string): Promise<PublicProducer | null> {
  if (!SLUG_PATTERN.test(slug) || slug.length > 60) return null;

  const { data, error } = await createSupabaseAdminClient()
    .from('producers')
    .select('id, slug, stage_name')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) return null;
  const row = data as { id: string; slug: string; stage_name: string };
  return { id: row.id, slug: row.slug, stageName: row.stage_name };
}
