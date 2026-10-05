// Servicio de artistas: aqui viven las REGLAS del negocio (y sus
// validaciones, igual que ArtistService en la API de Java).
//
//   Server Action (lee el formulario)  ->  ArtistService (reglas)
//                                              ├─ ArtistRepository  (base de datos)
//                                              └─ SitePublisher     (sitio estatico)
//
// No importa Supabase ni GitHub: recibe por constructor un ArtistRepository,
// un SitePublisher y un CoverFetcher. Quien decide las implementaciones
// reales es backend/artists/index.ts.
//
// Fuente de verdad: las tablas de Supabase. Las paginas estaticas de
// `artistas/`, el directorio, el sitemap y los JSON `artist-data.json` /
// `artist-release-history.json` son una PROYECCION que se regenera desde la
// base en cada cambio: no se editan a mano.
//
// Orden de operaciones:
//  - Guardar / mover / publicar lanzamiento: primero la base, despues el
//    sitio. Si publicar falla, los datos ya estan a salvo y volver a guardar
//    reintenta.
//  - Borrar: primero el sitio, despues la base. Si la base falla, el artista
//    sigue existiendo y la siguiente publicacion vuelve a generar su pagina.
//
// Errores: lanza errores con tipo (backend/core/errors.ts). Nunca decide como se
// muestran: eso es de backend/core/safe-action.ts.

import {
  compactArtistName,
  slugify,
  type Artist,
  type CasaCatalogConfig
} from '@/backend/integrations/artist-renderer';
import {
  ConflictError,
  NotFoundError,
  PublishError,
  ValidationError
} from '@/backend/core/errors';
import { SOCIAL_KEYS, SOCIAL_LABELS, isSocialKey, normalizeSocialOrder, type SocialKey } from '@/shared/socials';
import type { UploadedImage } from '@/backend/artists/images';
import { buildArtistReleaseSharePages } from '@/backend/artists/release-pages';
import type {
  ArtistRecord,
  ArtistRepository,
  ArtistWrite,
  CoverFetcher,
  PublishFile,
  PublishOptions,
  Roster,
  SitePublisher
} from '@/backend/artists/types';

// ---------------------------------------------------------------------------
// Validaciones y utilidades puras
// ---------------------------------------------------------------------------

const PHOTO_PATH = /^assets\/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/;

const text = (value: string | null | undefined) => String(value ?? '').trim();

const validUrl = (value: string, label: string, options: { required?: boolean; httpsOnly?: boolean } = {}) => {
  const clean = text(value);
  if (!clean) {
    if (options.required) throw new ValidationError(`${label} es obligatorio.`);
    return '';
  }

  try {
    const url = new URL(clean);
    const allowed = options.httpsOnly
      ? url.protocol === 'https:'
      : url.protocol === 'http:' || url.protocol === 'https:';
    if (!allowed) throw new Error('protocol');
  } catch {
    throw new ValidationError(`${label} debe ser un enlace completo que empiece por https://.`);
  }
  return clean;
};

const cleanLinks = (links: Record<string, string>) => {
  const clean: Record<string, string> = {};
  for (const [network, value] of Object.entries(links)) {
    if (!isSocialKey(network)) throw new ValidationError(`${network} no es una red valida.`);
    const url = validUrl(value, SOCIAL_LABELS[network]);
    if (url) clean[network] = url;
  }
  return clean;
};

const optionalSocialKey = (value: string | null | undefined, label: string): SocialKey | null => {
  const key = text(value);
  if (!key) return null;
  if (!isSocialKey(key)) throw new ValidationError(`${label} no es una red valida.`);
  return key;
};

const imageFile = (path: string, image: UploadedImage): PublishFile => ({
  path,
  content: image.contentBase64,
  encoding: 'base64'
});

const toRoster = (records: ArtistRecord[]): Roster => ({
  records,
  data: { artists: records.map(record => record.artist) },
  history: {
    artists: Object.fromEntries(
      records.filter(record => record.releases.length).map(record => [record.artist.slug, record.releases])
    )
  }
});

const nextPreviewVersion = (releases: ArtistRecord['releases'], artistSlug: string, releaseSlug: string) => {
  const baseSlug = `${artistSlug}-${releaseSlug}`;
  const versions = releases
    .map(release => release.shareUrl?.match(new RegExp(`/lanzamientos/${baseSlug}-v(\\d+)/`))?.[1])
    .filter(Boolean)
    .map(Number);

  return String(Math.max(0, ...versions) + 1);
};

// ---------------------------------------------------------------------------
// Entradas (lo que la Server Action le entrega al servicio)
// ---------------------------------------------------------------------------

export type SaveArtistInput = {
  originalSlug: string;
  name: string;
  slug: string;
  role: string;
  cardName: string;
  tagline: string;
  bio: string;
  photo: string;
  uploadedPhoto: UploadedImage | null;
  links: Record<string, string>;
  // null = no tocar el orden de redes que ya tiene el artista.
  socialOrder: SocialKey[] | null;
  beatsEmbed: string;
  productionsEmbed: string;
  contactLabel: string;
  contactUrl: string;
};

export type AddReleaseInput = {
  artistSlug: string;
  title: string;
  slug: string;
  link: string;
  cover: string;
  uploadedCover: UploadedImage | null;
};

export type PortalInput = {
  // Un valor por red (puede venir vacio = quitar ese link).
  links: Record<string, string>;
  socialOrder: SocialKey[];
  heroPrimary: string;
  heroSecondary: string;
  releaseLink: string;
};

// Aplica lo que el artista envio sobre una COPIA de su perfil y valida las
// reglas del portal. No guarda nada: lo usan tanto el perfil real (guarda en
// la base) como la cuenta de prueba (guarda en los metadatos del usuario).
export const applyPortalInput = (current: Artist, input: PortalInput): Artist => {
  const artist = structuredClone(current);

  const links = cleanLinks(Object.fromEntries(SOCIAL_KEYS.map(key => [key, input.links[key] ?? ''])));
  artist.links = links;
  artist.socialOrder = normalizeSocialOrder(input.socialOrder);

  const primary = optionalSocialKey(input.heroPrimary, 'El botón principal');
  const secondary = optionalSocialKey(input.heroSecondary, 'El botón secundario');
  if (primary && !links[primary]) {
    throw new ValidationError(`Agrega primero tu enlace de ${SOCIAL_LABELS[primary]} para usarlo en el botón principal.`);
  }
  if (secondary && !links[secondary]) {
    throw new ValidationError(`Agrega primero tu enlace de ${SOCIAL_LABELS[secondary]} para usarlo en el botón secundario.`);
  }
  if (primary && secondary && primary === secondary) {
    throw new ValidationError('Elige dos redes diferentes para los botones superiores.');
  }
  artist.heroButtons = primary || secondary
    ? { primary: primary ?? undefined, secondary: secondary ?? undefined }
    : undefined;

  if (artist.release) {
    const releaseLink = validUrl(input.releaseLink, 'El enlace de la canción actual', { required: true });
    artist.release = { ...artist.release, link: releaseLink };
  }

  return artist;
};

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

export class ArtistService {
  constructor(
    private readonly repository: ArtistRepository,
    private readonly publisher: SitePublisher,
    private readonly fetchCover: CoverFetcher
  ) {}

  async loadRoster(): Promise<Roster> {
    return toRoster(await this.repository.listArtists());
  }

  async findArtistBySlug(slug: string): Promise<ArtistRecord | null> {
    return (await this.repository.listArtists()).find(record => record.artist.slug === slug) ?? null;
  }

  // Para operaciones que ya escribieron en la base: si publicar falla, se
  // avisa que los datos quedaron guardados y que reintentar es volver a guardar.
  private async publishAfterSave(roster: Roster, options: PublishOptions) {
    try {
      await this.publisher.publishRoster(roster, options);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new PublishError(
        `Los cambios quedaron guardados, pero no pude publicar la pagina: ${reason}. Vuelve a guardar para reintentar.`,
        { cause: error }
      );
    }
  }

  async saveArtist(input: SaveArtistInput) {
    const name = text(input.name);
    const slug = slugify(text(input.slug) || name);
    if (!name) throw new ValidationError('El nombre artistico es obligatorio.');
    if (!slug) throw new ValidationError('El slug del artista es obligatorio.');

    const links = cleanLinks(input.links);
    const beatsEmbed = validUrl(input.beatsEmbed, 'El embed de beats', { httpsOnly: true });
    const productionsEmbed = validUrl(input.productionsEmbed, 'El embed de producciones', { httpsOnly: true });
    const contactUrl = validUrl(input.contactUrl, 'El enlace de contacto');

    const records = await this.repository.listArtists();
    const originalSlug = text(input.originalSlug);
    // El formulario de EDITAR siempre manda originalSlug; el de CREAR no. Asi
    // crear con un slug que ya existe es un conflicto (409), igual que el POST
    // de la API de Java, y no sobrescribe en silencio al artista existente.
    const existing = originalSlug
      ? records.find(record => record.artist.slug === originalSlug) ?? null
      : null;
    if (originalSlug && !existing) {
      throw new NotFoundError('Ese artista ya no existe (alguien lo borro o lo renombro). Recarga la pagina.');
    }
    if (!existing && records.some(record => record.artist.slug === slug)) {
      throw new ConflictError('Ya existe un artista con ese slug.');
    }
    if (existing && existing.artist.slug !== slug && records.some(record => record.artist.slug === slug)) {
      throw new ConflictError('Ya existe otro artista con ese slug.');
    }

    const photoPath = input.uploadedPhoto
      ? `assets/${slug}-photo.${input.uploadedPhoto.extension}`
      : text(input.photo) || null;
    if (photoPath && !PHOTO_PATH.test(photoPath)) {
      throw new ValidationError('La foto debe estar en assets/ y ser JPG, PNG o WebP.');
    }

    const previous = existing?.artist;
    const write: ArtistWrite = {
      slug,
      name,
      cardName: text(input.cardName) || compactArtistName(name),
      role: text(input.role) || 'Artista oficial',
      tagline: text(input.tagline) || 'Música con identidad, visión y propósito.',
      bio: text(input.bio) || `Perfil oficial de ${name} dentro del ecosistema Lujo Urban.`,
      photoPath,
      socialOrder: normalizeSocialOrder(input.socialOrder ?? previous?.socialOrder),
      heroPrimary: previous?.heroButtons?.primary ?? null,
      heroSecondary: previous?.heroButtons?.secondary ?? null,
      beatsEmbedUrl: beatsEmbed || null,
      productionsEmbedUrl: productionsEmbed || null,
      contactLabel: contactUrl ? text(input.contactLabel) || 'Booking' : null,
      contactUrl: contactUrl || null
    };

    let artistId: string;
    if (existing) {
      artistId = existing.id;
      await this.repository.updateArtist(artistId, write);
    } else {
      artistId = await this.repository.insertArtist(write);
    }
    await this.repository.replaceLinks(artistId, links);

    // Renombrar un artista deja huerfana su pagina vieja: se borra en el mismo commit.
    const renamedFrom = existing && existing.artist.slug !== slug ? [existing.artist.slug] : [];

    await this.publishAfterSave(await this.loadRoster(), {
      message: existing ? `Update artist ${name}` : `Create artist ${name}`,
      extraFiles: input.uploadedPhoto && photoPath ? [imageFile(photoPath, input.uploadedPhoto)] : [],
      removedArtistSlugs: renamedFrom
    });
  }

  async moveArtist(slug: string, direction: 'up' | 'down') {
    const records = await this.repository.listArtists();
    const fromIndex = records.findIndex(record => record.artist.slug === slug);
    if (fromIndex < 0) throw new NotFoundError('No encontre ese artista.');

    const toIndex = direction === 'up'
      ? Math.max(0, fromIndex - 1)
      : Math.min(records.length - 1, fromIndex + 1);
    if (toIndex === fromIndex) return;

    const reordered = [...records];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    await this.repository.setPositions(reordered.map(record => record.id));

    await this.publishAfterSave(toRoster(reordered), { message: `Move artist ${moved.artist.name}` });
  }

  // Borrar un artista = borrar TODO lo suyo: su pagina publica, las paginas
  // de compartir de sus lanzamientos y (por cascada en la base) sus links,
  // lanzamientos y acceso al portal. Las imagenes en assets/ se conservan.
  async deleteArtist(slug: string) {
    const records = await this.repository.listArtists();
    const record = records.find(item => item.artist.slug === slug);
    if (!record) throw new NotFoundError('No encontre ese artista.');

    const remaining = toRoster(records.filter(item => item.id !== record.id));
    try {
      await this.publisher.publishRoster(remaining, {
        message: `Delete artist ${record.artist.name}`,
        removedArtistSlugs: [slug],
        removedReleases: record.releases
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new PublishError(
        `No se borro nada: no pude retirar la pagina del artista (${reason}). Intenta de nuevo.`,
        { cause: error }
      );
    }
    await this.repository.deleteArtistById(record.id);
  }

  async addRelease(input: AddReleaseInput) {
    const artistSlug = text(input.artistSlug);
    const title = text(input.title);
    const releaseSlug = slugify(text(input.slug) || title);
    const link = validUrl(input.link, 'El link del lanzamiento', { required: true });

    if (!artistSlug) throw new ValidationError('Selecciona un artista.');
    if (!title) throw new ValidationError('El nombre del lanzamiento es obligatorio.');
    if (!releaseSlug) throw new ValidationError('El slug del lanzamiento es obligatorio.');

    const record = await this.findArtistBySlug(artistSlug);
    if (!record) throw new NotFoundError('No encontre ese artista.');

    const coverImage = input.uploadedCover ?? (text(input.cover) ? null : await this.fetchCover(link));
    const coverPath = coverImage
      ? `assets/${artistSlug}-${releaseSlug}-cover.${coverImage.extension}`
      : text(input.cover) || null;
    if (coverPath && !PHOTO_PATH.test(coverPath)) {
      throw new ValidationError('La portada debe estar en assets/ y ser JPG, PNG o WebP.');
    }

    const version = nextPreviewVersion(record.releases, artistSlug, releaseSlug);
    const socialPages = coverPath
      ? buildArtistReleaseSharePages({ artist: record.artist, releaseTitle: title, releaseSlug, version, cover: coverPath })
      : null;

    const releaseId = await this.repository.upsertRelease(record.id, {
      slug: releaseSlug,
      title,
      link,
      coverPath,
      shareUrl: socialPages?.shareUrl ?? null,
      statusUrl: socialPages?.statusUrl ?? null
    });
    await this.repository.setCurrentRelease(record.id, releaseId);

    await this.publishAfterSave(await this.loadRoster(), {
      message: `Set ${title} as latest release for ${record.artist.name}`,
      extraFiles: [
        ...(coverImage && coverPath ? [imageFile(coverPath, coverImage)] : []),
        ...(socialPages?.files ?? [])
      ]
    });
  }

  async reactivateRelease(artistSlug: string, releaseSlug: string) {
    const record = await this.findArtistBySlug(text(artistSlug));
    if (!record) throw new NotFoundError('No encontre ese artista.');

    const release = record.releases.find(item => item.slug === releaseSlug);
    const releaseId = record.releaseIdsBySlug[releaseSlug];
    if (!release || !releaseId) throw new NotFoundError('No encontre ese lanzamiento del artista.');

    await this.repository.setCurrentRelease(record.id, releaseId);
    await this.publishAfterSave(await this.loadRoster(), {
      message: `Reactivate ${release.title} for ${record.artist.name}`
    });
  }

  // Lo que el artista edita desde su portal. Devuelve el antes y el despues
  // para que la accion registre la actividad.
  async savePortalProfile(artistSlug: string, input: PortalInput) {
    const record = await this.findArtistBySlug(artistSlug);
    if (!record) throw new NotFoundError('Tu cuenta ya no esta vinculada a un perfil publicado.');

    const before = record.artist;
    const after = applyPortalInput(before, input);

    await this.repository.updatePortalFields(record.id, {
      socialOrder: after.socialOrder ?? normalizeSocialOrder(null),
      heroPrimary: after.heroButtons?.primary ?? null,
      heroSecondary: after.heroButtons?.secondary ?? null
    });
    await this.repository.replaceLinks(record.id, after.links ?? {});
    if (record.currentReleaseId && after.release && after.release.link !== before.release?.link) {
      await this.repository.updateReleaseLink(record.currentReleaseId, after.release.link);
    }

    await this.publishAfterSave(await this.loadRoster(), { message: `Update artist links for ${before.name}` });

    return { before, after };
  }

  // Casa (lujourban-vision) muestra a los artistas mas recientes y un
  // catalogo fijado a mano; al cambiarlo solo se regenera esa pagina.
  async publishCasaCatalog(catalog: CasaCatalogConfig, message: string) {
    const roster = await this.loadRoster();
    try {
      await this.publisher.publishCasaCatalog(roster, catalog, message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new PublishError(`No pude publicar el catalogo de Casa: ${reason}.`, { cause: error });
    }
  }
}
