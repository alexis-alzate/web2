// Repositorio de artistas sobre Supabase: la UNICA clase que habla con las
// tablas `artists`, `artist_links` y `artist_releases` (migracion 017).
//
// Solo lee y escribe filas. No valida reglas de negocio, no toca GitHub, no
// conoce formularios (eso es del servicio). Su unico trabajo "extra" es
// traducir los errores de Postgres a errores con tipo.
//
// El cliente llega por constructor. En produccion es el cliente service_role
// del panel, asi que RLS no aplica: quien llame ya paso por requireAdmin() o
// requireActiveArtist().

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Artist, ArtistRelease } from '@/lib/artist-renderer';
import { ConflictError, ValidationError } from '@/lib/errors';
import { isSocialKey } from '@/lib/socials';
import type {
  ArtistRecord,
  ArtistRepository,
  ArtistWrite,
  PortalWrite,
  ReleaseWrite
} from './types';

type ArtistRow = {
  id: string;
  slug: string;
  name: string;
  card_name: string;
  role: string;
  tagline: string;
  bio: string;
  photo_path: string | null;
  social_order: string[];
  hero_primary: string | null;
  hero_secondary: string | null;
  beats_embed_url: string | null;
  productions_embed_url: string | null;
  contact_label: string | null;
  contact_url: string | null;
  position: number;
  current_release_id: string | null;
};

type LinkRow = { artist_id: string; network: string; url: string };

type ReleaseRow = {
  id: string;
  artist_id: string;
  slug: string;
  title: string;
  link: string;
  cover_path: string | null;
  share_url: string | null;
  status_url: string | null;
};

type DbError = { code?: string; message: string };

// Traduce errores de Postgres a errores con tipo. Las reglas (slug unico,
// URLs https, etc.) las hace cumplir la base de datos: aqui solo se explican.
// Cualquier otro error de base es inesperado (INTERNAL): se conserva con su
// causa para que quede en los logs.
const fail = (action: string, error: DbError): never => {
  if (error.code === '23505') {
    throw new ConflictError(`No pude ${action}: ya existe un registro con ese slug.`, { cause: error });
  }
  if (error.code === '23514') {
    throw new ValidationError(
      `No pude ${action}: un dato no cumple las reglas de la base (${error.message}).`,
      { cause: error }
    );
  }
  throw new Error(`No pude ${action}: ${error.message}`, { cause: error });
};

const toRelease = (row: ReleaseRow): ArtistRelease => ({
  title: row.title,
  slug: row.slug,
  link: row.link,
  cover: row.cover_path ?? undefined,
  shareUrl: row.share_url ?? undefined,
  statusUrl: row.status_url ?? undefined
});

const toRecord = (row: ArtistRow, links: LinkRow[], releases: ReleaseRow[]): ArtistRecord => {
  const heroPrimary = row.hero_primary && isSocialKey(row.hero_primary) ? row.hero_primary : undefined;
  const heroSecondary = row.hero_secondary && isSocialKey(row.hero_secondary) ? row.hero_secondary : undefined;
  const current = releases.find(release => release.id === row.current_release_id);

  const artist: Artist = {
    name: row.name,
    cardName: row.card_name,
    slug: row.slug,
    role: row.role,
    tagline: row.tagline,
    bio: row.bio,
    photo: row.photo_path ?? undefined,
    links: Object.fromEntries(links.map(link => [link.network, link.url])),
    socialOrder: row.social_order.filter(isSocialKey),
    heroButtons: heroPrimary || heroSecondary ? { primary: heroPrimary, secondary: heroSecondary } : undefined,
    release: current ? toRelease(current) : null,
    beatsEmbed: row.beats_embed_url ?? '',
    productionsEmbed: row.productions_embed_url ?? '',
    contact: row.contact_url ? { label: row.contact_label ?? undefined, url: row.contact_url } : null
  };

  return {
    id: row.id,
    currentReleaseId: row.current_release_id,
    releaseIdsBySlug: Object.fromEntries(releases.map(release => [release.slug, release.id])),
    releases: releases.map(toRelease),
    artist
  };
};

const toArtistColumns = (write: ArtistWrite) => ({
  slug: write.slug,
  name: write.name,
  card_name: write.cardName,
  role: write.role,
  tagline: write.tagline,
  bio: write.bio,
  photo_path: write.photoPath,
  social_order: write.socialOrder,
  hero_primary: write.heroPrimary,
  hero_secondary: write.heroSecondary,
  beats_embed_url: write.beatsEmbedUrl,
  productions_embed_url: write.productionsEmbedUrl,
  contact_label: write.contactLabel,
  contact_url: write.contactUrl
});

export class SupabaseArtistRepository implements ArtistRepository {
  constructor(private readonly getClient: () => SupabaseClient) {}

  // Trae todo el roster en 3 consultas y lo une en memoria. Son pocos
  // artistas; si algun dia hay cientos, aqui es donde se optimiza (sin tocar
  // nada mas).
  async listArtists(): Promise<ArtistRecord[]> {
    const supabase = this.getClient();
    const [artistsResult, linksResult, releasesResult] = await Promise.all([
      supabase.from('artists').select('*').order('position', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('artist_links').select('artist_id, network, url'),
      supabase.from('artist_releases').select('*').order('created_at', { ascending: true })
    ]);

    if (artistsResult.error) fail('leer los artistas', artistsResult.error);
    if (linksResult.error) fail('leer los links de los artistas', linksResult.error);
    if (releasesResult.error) fail('leer los lanzamientos de los artistas', releasesResult.error);

    const links = (linksResult.data ?? []) as LinkRow[];
    const releases = (releasesResult.data ?? []) as ReleaseRow[];

    return ((artistsResult.data ?? []) as ArtistRow[]).map(row =>
      toRecord(
        row,
        links.filter(link => link.artist_id === row.id),
        releases.filter(release => release.artist_id === row.id)
      )
    );
  }

  // Crea el artista al final del roster y devuelve su id.
  async insertArtist(write: ArtistWrite): Promise<string> {
    const supabase = this.getClient();
    const { data: last, error: lastError } = await supabase
      .from('artists')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) fail('calcular la posicion del artista', lastError);

    const position = last ? (last as { position: number }).position + 1 : 0;
    const { data, error } = await supabase
      .from('artists')
      .insert({ ...toArtistColumns(write), position })
      .select('id')
      .single();
    if (error || !data) return fail('crear el artista', error ?? { message: 'sin respuesta' });

    return (data as { id: string }).id;
  }

  async updateArtist(id: string, write: ArtistWrite): Promise<void> {
    const { error } = await this.getClient().from('artists').update(toArtistColumns(write)).eq('id', id);
    if (error) fail('guardar el artista', error);
  }

  // Deja exactamente estos links: agrega/actualiza los nuevos y despues quita
  // los que ya no estan. Se hace en ese orden para que un fallo a medias nunca
  // borre un link sin haber guardado el reemplazo.
  async replaceLinks(artistId: string, links: Record<string, string>): Promise<void> {
    const supabase = this.getClient();
    const entries = Object.entries(links);

    if (entries.length) {
      const { error } = await supabase
        .from('artist_links')
        .upsert(
          entries.map(([network, url]) => ({ artist_id: artistId, network, url })),
          { onConflict: 'artist_id,network' }
        );
      if (error) fail('guardar los links', error);
    }

    const keep = entries.map(([network]) => network);
    let removal = supabase.from('artist_links').delete().eq('artist_id', artistId);
    if (keep.length) removal = removal.not('network', 'in', `(${keep.join(',')})`);
    const { error: removeError } = await removal;
    if (removeError) fail('quitar links antiguos', removeError);
  }

  // `orderedIds` es el roster completo en el orden deseado.
  async setPositions(orderedIds: string[]): Promise<void> {
    const supabase = this.getClient();
    const results = await Promise.all(
      orderedIds.map((id, position) => supabase.from('artists').update({ position }).eq('id', id))
    );
    const failed = results.find(result => result.error);
    if (failed?.error) fail('reordenar los artistas', failed.error);
  }

  // Borra al artista. La base se encarga en cascada de sus links,
  // lanzamientos y acceso al portal (artist_access).
  async deleteArtistById(id: string): Promise<void> {
    const { error } = await this.getClient().from('artists').delete().eq('id', id);
    if (error) fail('borrar el artista', error);
  }

  // Crea o actualiza un lanzamiento (clave: artista + slug) y devuelve su id.
  async upsertRelease(artistId: string, write: ReleaseWrite): Promise<string> {
    const { data, error } = await this.getClient()
      .from('artist_releases')
      .upsert(
        {
          artist_id: artistId,
          slug: write.slug,
          title: write.title,
          link: write.link,
          cover_path: write.coverPath,
          share_url: write.shareUrl,
          status_url: write.statusUrl
        },
        { onConflict: 'artist_id,slug' }
      )
      .select('id')
      .single();
    if (error || !data) return fail('guardar el lanzamiento', error ?? { message: 'sin respuesta' });

    return (data as { id: string }).id;
  }

  async setCurrentRelease(artistId: string, releaseId: string): Promise<void> {
    const { error } = await this.getClient().from('artists').update({ current_release_id: releaseId }).eq('id', artistId);
    if (error) fail('marcar el lanzamiento actual', error);
  }

  async updateReleaseLink(releaseId: string, link: string): Promise<void> {
    const { error } = await this.getClient().from('artist_releases').update({ link }).eq('id', releaseId);
    if (error) fail('actualizar el enlace del lanzamiento', error);
  }

  async updatePortalFields(artistId: string, write: PortalWrite): Promise<void> {
    const { error } = await this.getClient()
      .from('artists')
      .update({
        social_order: write.socialOrder,
        hero_primary: write.heroPrimary,
        hero_secondary: write.heroSecondary
      })
      .eq('id', artistId);
    if (error) fail('guardar tu perfil', error);
  }
}
