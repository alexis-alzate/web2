// Servicio de artistas: aqui viven las REGLAS del negocio.
//
//   Server Action (lee el formulario)  ->  service (reglas)  ->  repository (base de datos)
//                                                            ->  github.ts (publicar el sitio)
//
// Fuente de verdad: las tablas de Supabase. Las paginas estaticas de
// `artistas/`, el directorio, el sitemap y los JSON `artist-data.json` /
// `artist-release-history.json` son una PROYECCION que se regenera desde la
// base en cada cambio: no se editan a mano.
//
// Orden de operaciones:
//  - Guardar / mover / publicar lanzamiento: primero la base, despues GitHub.
//    Si GitHub falla, los datos ya estan a salvo y volver a guardar reintenta.
//  - Borrar: primero GitHub, despues la base. Si la base falla, el artista
//    sigue existiendo y la siguiente publicacion vuelve a generar su pagina.

import { commitFiles, readFile, readJson, type CommitFile } from '@/lib/github';
import {
  buildArtistFiles,
  compactArtistName,
  slugify,
  type Artist,
  type ArtistData,
  type ArtistReleaseHistory,
  type CasaCatalogConfig,
  type VisionBuildInputs,
  type VisionCatalogEntry,
  updateVisionContent
} from '@/lib/artist-renderer';
import { SOCIAL_KEYS, SOCIAL_LABELS, isSocialKey, normalizeSocialOrder, type SocialKey } from '@/lib/socials';
import { fetchSmartLinkCover, type UploadedImage } from './images';
import { buildArtistReleaseSharePages } from './release-pages';
import {
  deleteArtistById,
  findArtistBySlug,
  insertArtist,
  listArtists,
  replaceLinks,
  setCurrentRelease,
  setPositions,
  updateArtist,
  updatePortalFields,
  updateReleaseLink,
  upsertRelease,
  type ArtistRecord,
  type ArtistWrite
} from './repository';

// ---------------------------------------------------------------------------
// Lectura del roster
// ---------------------------------------------------------------------------

export type Roster = {
  records: ArtistRecord[];
  data: ArtistData;
  history: ArtistReleaseHistory;
};

const toRoster = (records: ArtistRecord[]): Roster => ({
  records,
  data: { artists: records.map(record => record.artist) },
  history: {
    artists: Object.fromEntries(
      records.filter(record => record.releases.length).map(record => [record.artist.slug, record.releases])
    )
  }
});

export const loadRoster = async (): Promise<Roster> => toRoster(await listArtists());

export const loadArtistBySlug = findArtistBySlug;

// ---------------------------------------------------------------------------
// Validaciones (reglas compartidas)
// ---------------------------------------------------------------------------

const PHOTO_PATH = /^assets\/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$/;

const text = (value: string | null | undefined) => String(value ?? '').trim();

const validUrl = (value: string, label: string, options: { required?: boolean; httpsOnly?: boolean } = {}) => {
  const clean = text(value);
  if (!clean) {
    if (options.required) throw new Error(`${label} es obligatorio.`);
    return '';
  }

  const expected = options.httpsOnly ? 'https:' : null;
  try {
    const url = new URL(clean);
    const allowed = expected ? url.protocol === expected : url.protocol === 'http:' || url.protocol === 'https:';
    if (!allowed) throw new Error('protocol');
  } catch {
    throw new Error(`${label} debe ser un enlace completo que empiece por https://.`);
  }
  return clean;
};

const cleanLinks = (links: Record<string, string>) => {
  const clean: Record<string, string> = {};
  for (const [network, value] of Object.entries(links)) {
    if (!isSocialKey(network)) throw new Error(`${network} no es una red valida.`);
    const url = validUrl(value, SOCIAL_LABELS[network]);
    if (url) clean[network] = url;
  }
  return clean;
};

const optionalSocialKey = (value: string | null | undefined, label: string): SocialKey | null => {
  const key = text(value);
  if (!key) return null;
  if (!isSocialKey(key)) throw new Error(`${label} no es una red valida.`);
  return key;
};

const imageFile = (path: string, image: UploadedImage): CommitFile => ({
  path,
  content: image.contentBase64,
  encoding: 'base64'
});

// ---------------------------------------------------------------------------
// Publicacion del sitio estatico
// ---------------------------------------------------------------------------

const artistPagePath = (slug: string) => `artistas/${slug}/index.html`;

// Las paginas de compartir de un lanzamiento viven en /lanzamientos/<x>/ y
// /estados/<x>/. Se sacan de las URLs guardadas y solo se aceptan rutas con
// esa forma exacta, para no borrar nada que no sea nuestro.
const releasePagePaths = (releases: ArtistRecord['releases']) =>
  releases
    .flatMap(release => [release.shareUrl, release.statusUrl])
    .flatMap(url => {
      if (!url) return [];
      try {
        const path = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
        return /^(lanzamientos|estados)\/[a-z0-9-]+$/.test(path) ? [`${path}/index.html`] : [];
      } catch {
        return [];
      }
    });

const loadVisionInputs = async (history: ArtistReleaseHistory): Promise<VisionBuildInputs> => {
  const [source, zaetta, catalog] = await Promise.all([
    readFile('lujourban-vision/index.html'),
    readJson<{ releases: VisionCatalogEntry[] }>('release-history.json', { releases: [] }),
    readJson<CasaCatalogConfig>('casa-catalog.json', { picks: [] })
  ]);
  return { source, releases: zaetta.releases, artistReleases: history.artists, catalog };
};

type PublishOptions = {
  message: string;
  extraFiles?: CommitFile[];
  deletes?: string[];
};

// Genera TODO el sitio de artistas desde el roster dado y lo sube en un solo
// commit. Es idempotente: publicar dos veces lo mismo no cambia nada.
const publishRoster = async (roster: Roster, options: PublishOptions) => {
  const [sitemap, vision] = await Promise.all([
    readFile('sitemap.xml'),
    loadVisionInputs(roster.history)
  ]);

  await commitFiles([
    ...buildArtistFiles(roster.data, sitemap, vision),
    { path: 'artist-release-history.json', content: `${JSON.stringify(roster.history, null, 2)}\n` },
    ...(options.extraFiles ?? [])
  ], options.message, { deletes: options.deletes });
};

// Para operaciones que ya escribieron en la base: si publicar falla, se avisa
// que los datos quedaron guardados y que reintentar es volver a guardar.
const publishAfterSave = async (roster: Roster, options: PublishOptions) => {
  try {
    await publishRoster(roster, options);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Los cambios quedaron guardados, pero no pude publicar la pagina: ${reason}. Vuelve a guardar para reintentar.`
    );
  }
};

// Casa (lujourban-vision) muestra a los artistas mas recientes y un catalogo
// fijado a mano. Al cambiar el catalogo solo se regenera esa pagina y el JSON
// del catalogo; las paginas de artistas no se tocan.
export const publishCasaCatalog = async (catalog: CasaCatalogConfig, message: string) => {
  const roster = await loadRoster();
  const vision = await loadVisionInputs(roster.history);

  await commitFiles([
    {
      path: 'lujourban-vision/index.html',
      content: updateVisionContent(vision.source, roster.data, vision.releases, vision.artistReleases, catalog)
    },
    { path: 'casa-catalog.json', content: `${JSON.stringify(catalog, null, 2)}\n` }
  ], message);
};

// ---------------------------------------------------------------------------
// Casos de uso del administrador
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

export const saveArtist = async (input: SaveArtistInput) => {
  const name = text(input.name);
  const slug = slugify(text(input.slug) || name);
  if (!name) throw new Error('El nombre artistico es obligatorio.');
  if (!slug) throw new Error('El slug del artista es obligatorio.');

  const links = cleanLinks(input.links);
  const beatsEmbed = validUrl(input.beatsEmbed, 'El embed de beats', { httpsOnly: true });
  const productionsEmbed = validUrl(input.productionsEmbed, 'El embed de producciones', { httpsOnly: true });
  const contactUrl = validUrl(input.contactUrl, 'El enlace de contacto');

  const records = await listArtists();
  const originalSlug = text(input.originalSlug);
  const existing = records.find(record => record.artist.slug === (originalSlug || slug)) ?? null;
  if (originalSlug && !existing) {
    throw new Error('Ese artista ya no existe (alguien lo borro o lo renombro). Recarga la pagina.');
  }
  if (!existing && records.some(record => record.artist.slug === slug)) {
    throw new Error('Ya existe un artista con ese slug.');
  }
  if (existing && existing.artist.slug !== slug && records.some(record => record.artist.slug === slug)) {
    throw new Error('Ya existe otro artista con ese slug.');
  }

  const photoPath = input.uploadedPhoto
    ? `assets/${slug}-photo.${input.uploadedPhoto.extension}`
    : text(input.photo) || null;
  if (photoPath && !PHOTO_PATH.test(photoPath)) {
    throw new Error('La foto debe estar en assets/ y ser JPG, PNG o WebP.');
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
    await updateArtist(artistId, write);
  } else {
    artistId = await insertArtist(write);
  }
  await replaceLinks(artistId, links);

  // Renombrar un artista deja huerfana su pagina vieja: se borra en el mismo commit.
  const deletes = existing && existing.artist.slug !== slug ? [artistPagePath(existing.artist.slug)] : [];

  await publishAfterSave(await loadRoster(), {
    message: existing ? `Update artist ${name}` : `Create artist ${name}`,
    extraFiles: input.uploadedPhoto && photoPath ? [imageFile(photoPath, input.uploadedPhoto)] : [],
    deletes
  });
};

export const moveArtist = async (slug: string, direction: 'up' | 'down') => {
  const records = await listArtists();
  const fromIndex = records.findIndex(record => record.artist.slug === slug);
  if (fromIndex < 0) throw new Error('No encontre ese artista.');

  const toIndex = direction === 'up'
    ? Math.max(0, fromIndex - 1)
    : Math.min(records.length - 1, fromIndex + 1);
  if (toIndex === fromIndex) return;

  const reordered = [...records];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  await setPositions(reordered.map(record => record.id));

  await publishAfterSave(toRoster(reordered), { message: `Move artist ${moved.artist.name}` });
};

// Borrar un artista = borrar TODO lo suyo: su pagina publica, las paginas de
// compartir de sus lanzamientos y (por cascada en la base) sus links,
// lanzamientos y acceso al portal. Las imagenes en assets/ se conservan.
export const deleteArtist = async (slug: string) => {
  const records = await listArtists();
  const record = records.find(item => item.artist.slug === slug);
  if (!record) throw new Error('No encontre ese artista.');

  const remaining = toRoster(records.filter(item => item.id !== record.id));
  await publishRoster(remaining, {
    message: `Delete artist ${record.artist.name}`,
    deletes: [artistPagePath(slug), ...releasePagePaths(record.releases)]
  });
  await deleteArtistById(record.id);
};

export type AddReleaseInput = {
  artistSlug: string;
  title: string;
  slug: string;
  link: string;
  cover: string;
  uploadedCover: UploadedImage | null;
};

const nextPreviewVersion = (releases: ArtistRecord['releases'], artistSlug: string, releaseSlug: string) => {
  const baseSlug = `${artistSlug}-${releaseSlug}`;
  const versions = releases
    .map(release => release.shareUrl?.match(new RegExp(`/lanzamientos/${baseSlug}-v(\\d+)/`))?.[1])
    .filter(Boolean)
    .map(Number);

  return String(Math.max(0, ...versions) + 1);
};

export const addRelease = async (input: AddReleaseInput) => {
  const artistSlug = text(input.artistSlug);
  const title = text(input.title);
  const releaseSlug = slugify(text(input.slug) || title);
  const link = validUrl(input.link, 'El link del lanzamiento', { required: true });

  if (!artistSlug) throw new Error('Selecciona un artista.');
  if (!title) throw new Error('El nombre del lanzamiento es obligatorio.');
  if (!releaseSlug) throw new Error('El slug del lanzamiento es obligatorio.');

  const record = await findArtistBySlug(artistSlug);
  if (!record) throw new Error('No encontre ese artista.');

  const coverImage = input.uploadedCover ?? (text(input.cover) ? null : await fetchSmartLinkCover(link));
  const coverPath = coverImage
    ? `assets/${artistSlug}-${releaseSlug}-cover.${coverImage.extension}`
    : text(input.cover) || null;
  if (coverPath && !PHOTO_PATH.test(coverPath)) {
    throw new Error('La portada debe estar en assets/ y ser JPG, PNG o WebP.');
  }

  const version = nextPreviewVersion(record.releases, artistSlug, releaseSlug);
  const socialPages = coverPath
    ? buildArtistReleaseSharePages({ artist: record.artist, releaseTitle: title, releaseSlug, version, cover: coverPath })
    : null;

  const releaseId = await upsertRelease(record.id, {
    slug: releaseSlug,
    title,
    link,
    coverPath,
    shareUrl: socialPages?.shareUrl ?? null,
    statusUrl: socialPages?.statusUrl ?? null
  });
  await setCurrentRelease(record.id, releaseId);

  await publishAfterSave(await loadRoster(), {
    message: `Set ${title} as latest release for ${record.artist.name}`,
    extraFiles: [
      ...(coverImage && coverPath ? [imageFile(coverPath, coverImage)] : []),
      ...(socialPages?.files ?? [])
    ]
  });
};

export const reactivateRelease = async (artistSlug: string, releaseSlug: string) => {
  const record = await findArtistBySlug(text(artistSlug));
  if (!record) throw new Error('No encontre ese artista.');

  const release = record.releases.find(item => item.slug === releaseSlug);
  const releaseId = record.releaseIdsBySlug[releaseSlug];
  if (!release || !releaseId) throw new Error('No encontre ese lanzamiento del artista.');

  await setCurrentRelease(record.id, releaseId);
  await publishAfterSave(await loadRoster(), {
    message: `Reactivate ${release.title} for ${record.artist.name}`
  });
};

// ---------------------------------------------------------------------------
// Portal del artista
// ---------------------------------------------------------------------------

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
    throw new Error(`Agrega primero tu enlace de ${SOCIAL_LABELS[primary]} para usarlo en el botón principal.`);
  }
  if (secondary && !links[secondary]) {
    throw new Error(`Agrega primero tu enlace de ${SOCIAL_LABELS[secondary]} para usarlo en el botón secundario.`);
  }
  if (primary && secondary && primary === secondary) {
    throw new Error('Elige dos redes diferentes para los botones superiores.');
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

export const savePortalProfile = async (artistSlug: string, input: PortalInput) => {
  const record = await findArtistBySlug(artistSlug);
  if (!record) throw new Error('Tu cuenta ya no esta vinculada a un perfil publicado.');

  const before = record.artist;
  const after = applyPortalInput(before, input);

  await updatePortalFields(record.id, {
    socialOrder: after.socialOrder ?? normalizeSocialOrder(null),
    heroPrimary: after.heroButtons?.primary ?? null,
    heroSecondary: after.heroButtons?.secondary ?? null
  });
  await replaceLinks(record.id, after.links ?? {});
  if (record.currentReleaseId && after.release && after.release.link !== before.release?.link) {
    await updateReleaseLink(record.currentReleaseId, after.release.link);
  }

  await publishAfterSave(await loadRoster(), { message: `Update artist links for ${before.name}` });

  return { before, after };
};
