// Dobles de prueba en memoria. Gracias a la inyeccion por constructor,
// ArtistService se prueba con un repositorio y un publicador falsos: sin
// Supabase, sin GitHub y sin red.
//
// Los dos dobles escriben en la MISMA bitacora (`log`), asi las pruebas pueden
// comprobar el orden de operaciones (base primero y publicar despues, o al
// reves al borrar).

import type { Artist, ArtistRelease, CasaCatalogConfig } from '@/lib/artist-renderer';
import { ArtistService } from '@/lib/artists/service';
import type {
  ArtistRecord,
  ArtistRepository,
  ArtistWrite,
  CoverFetcher,
  PortalWrite,
  PublishOptions,
  ReleaseWrite,
  Roster,
  SitePublisher
} from '@/lib/artists/types';

export type Log = string[];

export class FakeRepository implements ArtistRepository {
  records: ArtistRecord[] = [];
  private nextId = 1;
  // Metodos que deben fallar: nombre -> error que lanzan.
  failures: Partial<Record<keyof ArtistRepository, Error>> = {};

  constructor(private readonly log: Log) {}

  private enter(method: keyof ArtistRepository) {
    this.log.push(`repo.${method}`);
    const failure = this.failures[method];
    if (failure) throw failure;
  }

  private byId(id: string) {
    const record = this.records.find(item => item.id === id);
    if (!record) throw new Error(`FakeRepository: no existe el artista ${id}`);
    return record;
  }

  async listArtists() {
    this.enter('listArtists');
    return structuredClone(this.records);
  }

  async insertArtist(write: ArtistWrite) {
    this.enter('insertArtist');
    const id = `artist-${this.nextId++}`;
    this.records.push({
      id,
      currentReleaseId: null,
      releaseIdsBySlug: {},
      releases: [],
      artist: toArtist(write, {})
    });
    return id;
  }

  async updateArtist(id: string, write: ArtistWrite) {
    this.enter('updateArtist');
    const record = this.byId(id);
    record.artist = toArtist(write, record.artist.links ?? {}, record.artist.release ?? null);
  }

  async replaceLinks(artistId: string, links: Record<string, string>) {
    this.enter('replaceLinks');
    this.byId(artistId).artist.links = { ...links };
  }

  async setPositions(orderedIds: string[]) {
    this.enter('setPositions');
    this.records = orderedIds.map(id => this.byId(id));
  }

  async deleteArtistById(id: string) {
    this.enter('deleteArtistById');
    this.byId(id);
    this.records = this.records.filter(record => record.id !== id);
  }

  async upsertRelease(artistId: string, write: ReleaseWrite) {
    this.enter('upsertRelease');
    const record = this.byId(artistId);
    const release: ArtistRelease = {
      title: write.title,
      slug: write.slug,
      link: write.link,
      cover: write.coverPath ?? undefined,
      shareUrl: write.shareUrl ?? undefined,
      statusUrl: write.statusUrl ?? undefined
    };
    const existingId = record.releaseIdsBySlug[write.slug];
    const id = existingId ?? `release-${this.nextId++}`;
    record.releaseIdsBySlug[write.slug] = id;
    const index = record.releases.findIndex(item => item.slug === write.slug);
    if (index >= 0) record.releases[index] = release;
    else record.releases.push(release);
    return id;
  }

  async setCurrentRelease(artistId: string, releaseId: string) {
    this.enter('setCurrentRelease');
    const record = this.byId(artistId);
    record.currentReleaseId = releaseId;
    const slug = Object.entries(record.releaseIdsBySlug).find(([, id]) => id === releaseId)?.[0];
    record.artist.release = record.releases.find(release => release.slug === slug) ?? null;
  }

  async updateReleaseLink(releaseId: string, link: string) {
    this.enter('updateReleaseLink');
    for (const record of this.records) {
      const slug = Object.entries(record.releaseIdsBySlug).find(([, id]) => id === releaseId)?.[0];
      const release = record.releases.find(item => item.slug === slug);
      if (release) release.link = link;
      if (record.currentReleaseId === releaseId && record.artist.release) record.artist.release.link = link;
    }
  }

  async updatePortalFields(artistId: string, write: PortalWrite) {
    this.enter('updatePortalFields');
    const artist = this.byId(artistId).artist;
    artist.socialOrder = write.socialOrder;
    artist.heroButtons = write.heroPrimary || write.heroSecondary
      ? { primary: write.heroPrimary ?? undefined, secondary: write.heroSecondary ?? undefined }
      : undefined;
  }
}

export class FakePublisher implements SitePublisher {
  published: Array<{ roster: Roster; options: PublishOptions }> = [];
  casaPublished: Array<{ roster: Roster; catalog: CasaCatalogConfig; message: string }> = [];
  failure: Error | null = null;

  constructor(private readonly log: Log) {}

  async publishRoster(roster: Roster, options: PublishOptions) {
    this.log.push('publisher.publishRoster');
    if (this.failure) throw this.failure;
    this.published.push({ roster: structuredClone(roster), options });
  }

  async publishCasaCatalog(roster: Roster, catalog: CasaCatalogConfig, message: string) {
    this.log.push('publisher.publishCasaCatalog');
    if (this.failure) throw this.failure;
    this.casaPublished.push({ roster: structuredClone(roster), catalog, message });
  }
}

export const toArtist = (
  write: ArtistWrite,
  links: Record<string, string>,
  release: ArtistRelease | null = null
): Artist => ({
  name: write.name,
  cardName: write.cardName,
  slug: write.slug,
  role: write.role,
  tagline: write.tagline,
  bio: write.bio,
  photo: write.photoPath ?? undefined,
  links,
  socialOrder: write.socialOrder,
  heroButtons: write.heroPrimary || write.heroSecondary
    ? { primary: write.heroPrimary ?? undefined, secondary: write.heroSecondary ?? undefined }
    : undefined,
  release,
  beatsEmbed: write.beatsEmbedUrl ?? '',
  productionsEmbed: write.productionsEmbedUrl ?? '',
  contact: write.contactUrl ? { label: write.contactLabel ?? undefined, url: write.contactUrl } : null
});

export const makeService = (options: { cover?: CoverFetcher } = {}) => {
  const log: Log = [];
  const repository = new FakeRepository(log);
  const publisher = new FakePublisher(log);
  const fetchCover: CoverFetcher = options.cover ?? (async () => null);
  const service = new ArtistService(repository, publisher, fetchCover);
  return { service, repository, publisher, log };
};

// Entrada minima valida para crear un artista; cada prueba cambia solo lo que
// le interesa.
export const artistInput = (overrides: Partial<Parameters<ArtistService['saveArtist']>[0]> = {}) => ({
  originalSlug: '',
  name: 'Zaetta',
  slug: '',
  role: '',
  cardName: '',
  tagline: '',
  bio: '',
  photo: '',
  uploadedPhoto: null,
  links: {},
  socialOrder: null,
  beatsEmbed: '',
  productionsEmbed: '',
  contactLabel: '',
  contactUrl: '',
  ...overrides
});
