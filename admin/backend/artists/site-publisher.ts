// Publicador del sitio estatico: genera las paginas de artistas desde el
// roster y las sube a GitHub en un solo commit.
//
// Es el unico que conoce COMO esta organizado el sitio estatico (donde viven
// `artistas/<slug>/index.html`, `lanzamientos/...`, `estados/...`). El
// servicio solo le dice que cambio; aqui se traduce a archivos.
//
// El acceso a GitHub llega por constructor (GithubPort), asi que se puede
// probar sin red.

import {
  buildArtistFiles,
  updateVisionContent,
  type ArtistRelease,
  type ArtistReleaseHistory,
  type CasaCatalogConfig,
  type VisionBuildInputs,
  type VisionCatalogEntry
} from '@/backend/integrations/artist-renderer';
import { PublishError } from '@/backend/core/errors';
import type { PublishFile, PublishOptions, Roster, SitePublisher } from '@/backend/artists/types';

export interface GithubPort {
  readFile(path: string): Promise<string>;
  readJson<T>(path: string, fallback: T): Promise<T>;
  commitFiles(files: PublishFile[], message: string, options?: { deletes?: string[] }): Promise<unknown>;
}

const artistPagePath = (slug: string) => `artistas/${slug}/index.html`;

// Las paginas de compartir de un lanzamiento viven en /lanzamientos/<x>/ y
// /estados/<x>/. Se sacan de las URLs guardadas y solo se aceptan rutas con
// esa forma exacta, para no borrar nada que no sea nuestro.
const releasePagePaths = (releases: ArtistRelease[]) =>
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

const reasonOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export class GithubSitePublisher implements SitePublisher {
  constructor(private readonly github: GithubPort) {}

  private async loadVisionInputs(history: ArtistReleaseHistory): Promise<VisionBuildInputs> {
    const [source, zaetta, catalog] = await Promise.all([
      this.github.readFile('lujourban-vision/index.html'),
      this.github.readJson<{ releases: VisionCatalogEntry[] }>('release-history.json', { releases: [] }),
      this.github.readJson<CasaCatalogConfig>('casa-catalog.json', { picks: [] })
    ]);
    return { source, releases: zaetta.releases, artistReleases: history.artists, catalog };
  }

  // Genera TODO el sitio de artistas desde el roster dado y lo sube en un
  // solo commit. Es idempotente: publicar dos veces lo mismo no cambia nada.
  async publishRoster(roster: Roster, options: PublishOptions): Promise<void> {
    try {
      const [sitemap, vision] = await Promise.all([
        this.github.readFile('sitemap.xml'),
        this.loadVisionInputs(roster.history)
      ]);

      const deletes = [
        ...(options.removedArtistSlugs ?? []).map(artistPagePath),
        ...releasePagePaths(options.removedReleases ?? [])
      ];

      await this.github.commitFiles([
        ...buildArtistFiles(roster.data, sitemap, vision),
        { path: 'artist-release-history.json', content: `${JSON.stringify(roster.history, null, 2)}\n` },
        ...(options.extraFiles ?? [])
      ], options.message, { deletes });
    } catch (error) {
      throw new PublishError(reasonOf(error), { cause: error });
    }
  }

  // Casa (lujourban-vision) muestra a los artistas mas recientes y un
  // catalogo fijado a mano. Al cambiar el catalogo solo se regenera esa
  // pagina y el JSON del catalogo; las paginas de artistas no se tocan.
  async publishCasaCatalog(roster: Roster, catalog: CasaCatalogConfig, message: string): Promise<void> {
    try {
      const vision = await this.loadVisionInputs(roster.history);

      await this.github.commitFiles([
        {
          path: 'lujourban-vision/index.html',
          content: updateVisionContent(vision.source, roster.data, vision.releases, vision.artistReleases, catalog)
        },
        { path: 'casa-catalog.json', content: `${JSON.stringify(catalog, null, 2)}\n` }
      ], message);
    } catch (error) {
      throw new PublishError(reasonOf(error), { cause: error });
    }
  }
}
