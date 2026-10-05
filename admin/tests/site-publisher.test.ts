import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GithubSitePublisher, type GithubPort } from '@/lib/artists/site-publisher';
import type { PublishFile, Roster } from '@/lib/artists/types';
import type { Artist, ArtistRelease } from '@/lib/artist-renderer';
import { PublishError } from '@/lib/errors';

// Usa los archivos REALES del sitio (sitemap y micrositio de Casa) como
// entrada, asi se comprueba el generador de verdad, sin red.
const repoFile = (path: string) => readFileSync(resolve(__dirname, '../../', path), 'utf8');

const fakeGithubPort = (overrides: Partial<GithubPort> = {}) => {
  const commits: Array<{ files: PublishFile[]; message: string; options?: { deletes?: string[] } }> = [];
  const port: GithubPort = {
    readFile: async path => repoFile(path),
    readJson: async <T>(path: string, fallback: T) => {
      try {
        return JSON.parse(repoFile(path)) as T;
      } catch {
        return fallback;
      }
    },
    commitFiles: async (files, message, options) => {
      commits.push({ files, message, options });
      return { sha: 'abc' };
    },
    ...overrides
  };
  return { port, commits };
};

const artist = (slug: string, overrides: Partial<Artist> = {}): Artist => ({
  name: slug.toUpperCase(),
  slug,
  role: 'Artista oficial',
  tagline: 'frase',
  bio: 'bio',
  links: {},
  ...overrides
});

const rosterOf = (...artists: Artist[]): Roster => ({
  records: [],
  data: { artists },
  history: { artists: {} }
});

const paths = (files: PublishFile[]) => files.map(file => file.path);

describe('publishRoster', () => {
  it('genera todo el sitio de artistas en UN solo commit', async () => {
    const { port, commits } = fakeGithubPort();

    await new GithubSitePublisher(port).publishRoster(rosterOf(artist('ana'), artist('beto')), { message: 'Mi cambio' });

    expect(commits).toHaveLength(1);
    expect(commits[0].message).toBe('Mi cambio');
    expect(paths(commits[0].files)).toEqual(expect.arrayContaining([
      'artist-data.json',
      'artist-release-history.json',
      'artistas/index.html',
      'artistas/ana/index.html',
      'artistas/beto/index.html',
      'sitemap.xml',
      'lujourban-vision/index.html'
    ]));
  });

  it('agrega los archivos extra (fotos, portadas, paginas de compartir) al mismo commit', async () => {
    const { port, commits } = fakeGithubPort();

    await new GithubSitePublisher(port).publishRoster(rosterOf(artist('ana')), {
      message: 'm',
      extraFiles: [{ path: 'assets/ana-photo.png', content: 'AAAA', encoding: 'base64' }]
    });

    expect(commits[0].files).toContainEqual({ path: 'assets/ana-photo.png', content: 'AAAA', encoding: 'base64' });
  });

  it('es idempotente: publicar dos veces lo mismo genera los mismos archivos', async () => {
    const first = fakeGithubPort();
    const second = fakeGithubPort();
    const roster = rosterOf(artist('ana'));

    await new GithubSitePublisher(first.port).publishRoster(roster, { message: 'm' });
    await new GithubSitePublisher(second.port).publishRoster(roster, { message: 'm' });

    expect(first.commits[0].files).toEqual(second.commits[0].files);
  });

  it('el historial publicado es el del roster', async () => {
    const { port, commits } = fakeGithubPort();
    const hit: ArtistRelease = { title: 'Hit', slug: 'hit', link: 'https://x.co/hit' };
    const roster: Roster = { ...rosterOf(artist('ana')), history: { artists: { ana: [hit] } } };

    await new GithubSitePublisher(port).publishRoster(roster, { message: 'm' });

    const history = commits[0].files.find(file => file.path === 'artist-release-history.json');
    expect(JSON.parse(history!.content)).toEqual({ artists: { ana: [hit] } });
  });

  describe('borrado de paginas', () => {
    it('un artista quitado borra su pagina publica', async () => {
      const { port, commits } = fakeGithubPort();

      await new GithubSitePublisher(port).publishRoster(rosterOf(artist('beto')), {
        message: 'm',
        removedArtistSlugs: ['ana']
      });

      expect(commits[0].options?.deletes).toEqual(['artistas/ana/index.html']);
    });

    it('los lanzamientos quitados borran sus paginas de compartir y de estado', async () => {
      const { port, commits } = fakeGithubPort();

      await new GithubSitePublisher(port).publishRoster(rosterOf(), {
        message: 'm',
        removedReleases: [{
          title: 'Hit', slug: 'hit', link: 'https://x.co',
          shareUrl: 'https://www.lujourban.com/lanzamientos/ana-hit-v1/',
          statusUrl: 'https://www.lujourban.com/estados/ana-hit-v1/'
        }]
      });

      expect(commits[0].options?.deletes).toEqual([
        'lanzamientos/ana-hit-v1/index.html',
        'estados/ana-hit-v1/index.html'
      ]);
    });

    // Seguridad: solo se borran rutas con la forma EXACTA lanzamientos/<x> o
    // estados/<x>. Una URL manipulada en la base no puede borrar otra cosa.
    it.each([
      ['otra carpeta', 'https://www.lujourban.com/admin/panel/'],
      ['subcarpeta extra', 'https://www.lujourban.com/lanzamientos/a/b/'],
      ['la raiz', 'https://www.lujourban.com/'],
      ['la carpeta sola', 'https://www.lujourban.com/lanzamientos/'],
      ['subida con ..', 'https://www.lujourban.com/lanzamientos/../index.html'],
      ['mayusculas o raros', 'https://www.lujourban.com/lanzamientos/Mi_Cancion/'],
      ['un texto que no es URL', 'no-es-una-url']
    ])('NO borra nada si la URL apunta a %s', async (_label, url) => {
      const { port, commits } = fakeGithubPort();

      await new GithubSitePublisher(port).publishRoster(rosterOf(), {
        message: 'm',
        removedReleases: [{ title: 'x', slug: 'x', link: 'https://x.co', shareUrl: url, statusUrl: url }]
      });

      expect(commits[0].options?.deletes).toEqual([]);
    });

    it('un lanzamiento sin paginas de compartir no borra nada', async () => {
      const { port, commits } = fakeGithubPort();

      await new GithubSitePublisher(port).publishRoster(rosterOf(), {
        message: 'm',
        removedReleases: [{ title: 'x', slug: 'x', link: 'https://x.co' }]
      });

      expect(commits[0].options?.deletes).toEqual([]);
    });
  });

  describe('si algo falla se avisa como PublishError, con su causa', () => {
    it('falla el commit', async () => {
      const boom = new Error('GitHub API 500');
      const { port } = fakeGithubPort({ commitFiles: vi.fn().mockRejectedValue(boom) });

      const error = await new GithubSitePublisher(port).publishRoster(rosterOf(artist('ana')), { message: 'm' }).catch(e => e);

      expect(error).toBeInstanceOf(PublishError);
      expect(error.status).toBe(502);
      expect(error.message).toBe('GitHub API 500');
      expect(error.cause).toBe(boom);
    });

    it('falla leer el sitemap, y entonces no se hace ningun commit', async () => {
      const commitFiles = vi.fn();
      const { port } = fakeGithubPort({
        readFile: async path => {
          if (path === 'sitemap.xml') throw new Error('GitHub API 404');
          return repoFile(path);
        },
        commitFiles
      });

      await expect(new GithubSitePublisher(port).publishRoster(rosterOf(artist('ana')), { message: 'm' }))
        .rejects.toBeInstanceOf(PublishError);

      expect(commitFiles).not.toHaveBeenCalled();
    });

    it('un error que no es Error tambien se convierte en PublishError', async () => {
      const { port } = fakeGithubPort({ commitFiles: vi.fn().mockRejectedValue('texto suelto') });

      await expect(new GithubSitePublisher(port).publishRoster(rosterOf(), { message: 'm' }))
        .rejects.toThrow(new PublishError('texto suelto'));
    });
  });
});

describe('publishCasaCatalog', () => {
  it('regenera solo la pagina de Casa y el JSON del catalogo, sin tocar las paginas de artistas', async () => {
    const { port, commits } = fakeGithubPort();
    const catalog = { picks: [] };

    await new GithubSitePublisher(port).publishCasaCatalog(rosterOf(artist('ana')), catalog, 'Actualizar catalogo');

    expect(commits).toHaveLength(1);
    expect(paths(commits[0].files)).toEqual(['lujourban-vision/index.html', 'casa-catalog.json']);
    expect(commits[0].message).toBe('Actualizar catalogo');
    expect(JSON.parse(commits[0].files[1].content)).toEqual(catalog);
  });

  it('si falla el commit, es un PublishError', async () => {
    const { port } = fakeGithubPort({ commitFiles: vi.fn().mockRejectedValue(new Error('GitHub caido')) });

    await expect(new GithubSitePublisher(port).publishCasaCatalog(rosterOf(), { picks: [] }, 'm'))
      .rejects.toBeInstanceOf(PublishError);
  });
});
