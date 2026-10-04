// Repositorio de artistas: la UNICA capa que habla con las tablas `artists`,
// `artist_links` y `artist_releases` (migracion 017).
//
// Regla de esta capa: solo lee y escribe filas. No valida reglas de negocio,
// no toca GitHub, no conoce formularios. Eso vive en service.ts.
//
// Usa el cliente service_role del panel, asi que RLS no aplica: quien llame
// a estas funciones ya tiene que haber pasado por requireAdmin() o
// requireActiveArtist().

import type { Artist, ArtistRelease } from '@/lib/artist-renderer';
import { isSocialKey, type SocialKey } from '@/lib/socials';
import { createSupabaseAdminClient } from '@/lib/supabase/admin-client';

export type ArtistRecord = {
  id: string;
  artist: Artist;
  currentReleaseId: string | null;
  // slug del lanzamiento -> id en la base (el historial publico no lleva ids).
  releaseIdsBySlug: Record<string, string>;
  // Historial completo (el lanzamiento actual tambien esta aqui), del mas
  // viejo al mas nuevo.
  releases: ArtistRelease[];
};

export type ArtistWrite = {
  slug: string;
  name: string;
  cardName: string;
  role: string;
  tagline: string;
  bio: string;
  photoPath: string | null;
  socialOrder: SocialKey[];
  heroPrimary: SocialKey | null;
  heroSecondary: SocialKey | null;
  beatsEmbedUrl: string | null;
  productionsEmbedUrl: string | null;
  contactLabel: string | null;
  contactUrl: string | null;
};

export type ReleaseWrite = {
  slug: string;
  title: string;
  link: string;
  coverPath: string | null;
  shareUrl: string | null;
  statusUrl: string | null;
};

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

const db = () => createSupabaseAdminClient();

// Traduce errores de Postgres a mensajes que el admin pueda entender. Las
// reglas (slug unico, URLs https, etc.) las hace cumplir la base de datos:
// aqui solo se explican.
const fail = (action: string, error: DbError): never => {
  if (error.code === '23505') {
    throw new Error(`No pude ${action}: ya existe un registro con ese slug.`);
  }
  if (error.code === '23514') {
    throw new Error(`No pude ${action}: un dato no cumple las reglas de la base (${error.message}).`);
  }
  throw new Error(`No pude ${action}: ${error.message}`);
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

  return {
    id: row.id,
    currentReleaseId: row.current_release_id,
    releaseIdsBySlug: Object.fromEntries(releases.map(release => [release.slug, release.id])),
    releases: releases.map(toRelease),
    artist: {
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
    }
  };
};

// Trae todo el roster en 3 consultas y lo une en memoria. Son pocos artistas;
// si algun dia hay cientos, aqui es donde se optimiza (sin tocar nada mas).
export const listArtists = async (): Promise<ArtistRecord[]> => {
  const supabase = db();
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
};

export const findArtistBySlug = async (slug: string): Promise<ArtistRecord | null> =>
  (await listArtists()).find(record => record.artist.slug === slug) ?? null;

export const findArtistById = async (id: string): Promise<ArtistRecord | null> =>
  (await listArtists()).find(record => record.id === id) ?? null;

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

// Crea el artista al final del roster y devuelve su id.
export const insertArtist = async (write: ArtistWrite): Promise<string> => {
  const supabase = db();
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
};

export const updateArtist = async (id: string, write: ArtistWrite) => {
  const { error } = await db().from('artists').update(toArtistColumns(write)).eq('id', id);
  if (error) fail('guardar el artista', error);
};

// Deja exactamente estos links: agrega/actualiza los nuevos y despues quita
// los que ya no estan. Se hace en ese orden para que un fallo a medias nunca
// borre un link sin haber guardado el reemplazo.
export const replaceLinks = async (artistId: string, links: Record<string, string>) => {
  const supabase = db();
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
};

// `orderedIds` es el roster completo en el orden deseado.
export const setPositions = async (orderedIds: string[]) => {
  const supabase = db();
  const results = await Promise.all(
    orderedIds.map((id, position) => supabase.from('artists').update({ position }).eq('id', id))
  );
  const failed = results.find(result => result.error);
  if (failed?.error) fail('reordenar los artistas', failed.error);
};

// Borra al artista. La base se encarga en cascada de sus links, lanzamientos
// y acceso al portal (artist_access).
export const deleteArtistById = async (id: string) => {
  const { error } = await db().from('artists').delete().eq('id', id);
  if (error) fail('borrar el artista', error);
};

// Crea o actualiza un lanzamiento (clave: artista + slug) y devuelve su id.
export const upsertRelease = async (artistId: string, write: ReleaseWrite): Promise<string> => {
  const { data, error } = await db()
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
};

export const setCurrentRelease = async (artistId: string, releaseId: string) => {
  const { error } = await db().from('artists').update({ current_release_id: releaseId }).eq('id', artistId);
  if (error) fail('marcar el lanzamiento actual', error);
};

export const updateReleaseLink = async (releaseId: string, link: string) => {
  const { error } = await db().from('artist_releases').update({ link }).eq('id', releaseId);
  if (error) fail('actualizar el enlace del lanzamiento', error);
};

// Campos que el artista puede editar desde su portal (nada mas).
export type PortalWrite = {
  socialOrder: SocialKey[];
  heroPrimary: SocialKey | null;
  heroSecondary: SocialKey | null;
};

export const updatePortalFields = async (artistId: string, write: PortalWrite) => {
  const { error } = await db()
    .from('artists')
    .update({
      social_order: write.socialOrder,
      hero_primary: write.heroPrimary,
      hero_secondary: write.heroSecondary
    })
    .eq('id', artistId);
  if (error) fail('guardar tu perfil', error);
};
