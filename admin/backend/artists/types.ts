// Tipos y contratos (interfaces) de la capa de artistas.
//
// El servicio (service.ts) solo conoce ESTOS contratos, nunca a Supabase ni a
// GitHub. Las implementaciones reales se enchufan en backend/artists/index.ts.
// Es lo mismo que en Spring: un @Service que recibe por constructor una
// interfaz Repository, y quien decide cual implementacion va es la
// configuracion de la aplicacion.

import type {
  Artist,
  ArtistData,
  ArtistRelease,
  ArtistReleaseHistory,
  CasaCatalogConfig
} from '@/backend/integrations/artist-renderer';
import type { SocialKey } from '@/shared/socials';
import type { UploadedImage } from '@/backend/artists/images';

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

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

export type Roster = {
  records: ArtistRecord[];
  data: ArtistData;
  history: ArtistReleaseHistory;
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

// Campos que el artista puede editar desde su portal (nada mas).
export type PortalWrite = {
  socialOrder: SocialKey[];
  heroPrimary: SocialKey | null;
  heroSecondary: SocialKey | null;
};

export type PublishFile = {
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
};

export type PublishOptions = {
  message: string;
  // Archivos nuevos o actualizados ademas del sitio de artistas (fotos,
  // portadas, paginas para compartir).
  extraFiles?: PublishFile[];
  // El publicador sabe donde viven las paginas de cada cosa en el sitio
  // estatico: el servicio solo dice QUE se quito, no que archivos son.
  removedArtistSlugs?: string[];
  removedReleases?: ArtistRelease[];
};

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

// Persistencia de artistas. Implementacion real: SupabaseArtistRepository.
export interface ArtistRepository {
  listArtists(): Promise<ArtistRecord[]>;
  insertArtist(write: ArtistWrite): Promise<string>;
  updateArtist(id: string, write: ArtistWrite): Promise<void>;
  replaceLinks(artistId: string, links: Record<string, string>): Promise<void>;
  setPositions(orderedIds: string[]): Promise<void>;
  deleteArtistById(id: string): Promise<void>;
  upsertRelease(artistId: string, write: ReleaseWrite): Promise<string>;
  setCurrentRelease(artistId: string, releaseId: string): Promise<void>;
  updateReleaseLink(releaseId: string, link: string): Promise<void>;
  updatePortalFields(artistId: string, write: PortalWrite): Promise<void>;
}

// Publicacion del sitio estatico. Implementacion real: GithubSitePublisher.
// Lanza PublishError si no se pudo publicar; su mensaje es el motivo tecnico,
// el servicio lo convierte en una frase para la persona.
export interface SitePublisher {
  publishRoster(roster: Roster, options: PublishOptions): Promise<void>;
  publishCasaCatalog(roster: Roster, catalog: CasaCatalogConfig, message: string): Promise<void>;
}

// Busca la portada de un smart link. Devuelve null si no hay.
export type CoverFetcher = (smartLink: string) => Promise<UploadedImage | null>;
