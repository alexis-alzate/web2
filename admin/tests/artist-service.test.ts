import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPortalInput, type PortalInput } from '@/lib/artists/service';
import { ConflictError, NotFoundError, PublishError, ValidationError } from '@/lib/errors';
import type { Artist } from '@/lib/artist-renderer';
import { artistInput, makeService } from './helpers';

type Ctx = ReturnType<typeof makeService>;

// Crea artistas usando el propio servicio (asi se prueba tambien su camino
// real) y deja la bitacora y el publicador limpios para la prueba.
const seed = async (ctx: Ctx, ...names: string[]) => {
  for (const name of names) await ctx.service.saveArtist(artistInput({ name }));
  ctx.log.length = 0;
  ctx.publisher.published.length = 0;
};

const indexOf = (log: string[], entry: string) => log.indexOf(entry);

let ctx: Ctx;
beforeEach(() => {
  ctx = makeService();
});

describe('saveArtist: crear', () => {
  it('crea el artista, guarda sus links y despues publica', async () => {
    await ctx.service.saveArtist(artistInput({
      name: 'Ana Gómez',
      links: { spotify: 'https://open.spotify.com/artist/ana' }
    }));

    expect(ctx.repository.records).toHaveLength(1);
    expect(ctx.repository.records[0].artist.slug).toBe('ana-gomez');
    expect(ctx.repository.records[0].artist.links).toEqual({ spotify: 'https://open.spotify.com/artist/ana' });
    expect(ctx.publisher.published).toHaveLength(1);
    expect(ctx.publisher.published[0].options.message).toBe('Create artist Ana Gómez');
  });

  it('orden: primero la base, despues publicar (si GitHub falla los datos quedan a salvo)', async () => {
    await ctx.service.saveArtist(artistInput({ name: 'Ana' }));

    expect(indexOf(ctx.log, 'repo.insertArtist')).toBeLessThan(indexOf(ctx.log, 'publisher.publishRoster'));
    expect(indexOf(ctx.log, 'repo.replaceLinks')).toBeLessThan(indexOf(ctx.log, 'publisher.publishRoster'));
  });

  it('el slug sale del nombre si no se da uno, y se limpia', async () => {
    await ctx.service.saveArtist(artistInput({ name: 'Ñandú & Co.' }));

    expect(ctx.repository.records[0].artist.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('usa el slug dado cuando viene', async () => {
    await ctx.service.saveArtist(artistInput({ name: 'Ana', slug: 'Mi Slug Propio' }));

    expect(ctx.repository.records[0].artist.slug).toBe('mi-slug-propio');
  });

  it('rellena rol, frase y bio por defecto', async () => {
    await ctx.service.saveArtist(artistInput({ name: 'Ana' }));

    const artist = ctx.repository.records[0].artist;
    expect(artist.role).toBe('Artista oficial');
    expect(artist.tagline).not.toBe('');
    expect(artist.bio).toContain('Ana');
  });

  it('el contacto lleva la etiqueta "Booking" por defecto y solo existe si hay URL', async () => {
    await ctx.service.saveArtist(artistInput({ name: 'Ana', contactUrl: 'https://wa.me/573000000000' }));
    await ctx.service.saveArtist(artistInput({ name: 'Beto' }));

    expect(ctx.repository.records[0].artist.contact).toEqual({ label: 'Booking', url: 'https://wa.me/573000000000' });
    expect(ctx.repository.records[1].artist.contact).toBeNull();
  });

  it('una foto subida se guarda en assets/<slug>-photo y viaja al commit en base64', async () => {
    await ctx.service.saveArtist(artistInput({
      name: 'Ana',
      uploadedPhoto: { extension: 'png', contentBase64: 'AAAA' }
    }));

    expect(ctx.repository.records[0].artist.photo).toBe('assets/ana-photo.png');
    expect(ctx.publisher.published[0].options.extraFiles).toEqual([
      { path: 'assets/ana-photo.png', content: 'AAAA', encoding: 'base64' }
    ]);
  });
});

describe('saveArtist: validaciones (no escriben nada si fallan)', () => {
  const expectNothingWritten = () => {
    expect(ctx.log).not.toContain('repo.insertArtist');
    expect(ctx.log).not.toContain('repo.updateArtist');
    expect(ctx.log).not.toContain('publisher.publishRoster');
  };

  it('el nombre es obligatorio', async () => {
    await expect(ctx.service.saveArtist(artistInput({ name: '   ' }))).rejects.toThrow(ValidationError);
    expectNothingWritten();
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['sin protocolo', 'open.spotify.com/artist/ana'],
    ['ftp', 'ftp://example.com/archivo']
  ])('rechaza un link de red con %s', async (_label, url) => {
    await expect(ctx.service.saveArtist(artistInput({ links: { spotify: url } }))).rejects.toThrow(ValidationError);
    expectNothingWritten();
  });

  it('rechaza una red que no existe', async () => {
    await expect(ctx.service.saveArtist(artistInput({ links: { myspace: 'https://myspace.com/x' } })))
      .rejects.toThrow(/no es una red valida/);
    expectNothingWritten();
  });

  it('los embeds exigen https (http no vale)', async () => {
    await expect(ctx.service.saveArtist(artistInput({ beatsEmbed: 'http://example.com/embed' })))
      .rejects.toThrow(ValidationError);
    await expect(ctx.service.saveArtist(artistInput({ productionsEmbed: 'http://example.com/embed' })))
      .rejects.toThrow(ValidationError);
    expectNothingWritten();
  });

  it('el contacto admite http o https, pero no otros protocolos', async () => {
    await expect(ctx.service.saveArtist(artistInput({ contactUrl: 'mailto:a@b.co' }))).rejects.toThrow(ValidationError);
    expectNothingWritten();
  });

  it.each([
    ['fuera de assets/', 'otra/foto.png'],
    ['ruta con ..', 'assets/../secreto.png'],
    ['extension no permitida', 'assets/foto.gif'],
    ['URL externa', 'https://example.com/foto.png']
  ])('rechaza una foto %s', async (_label, photo) => {
    await expect(ctx.service.saveArtist(artistInput({ photo }))).rejects.toThrow(/assets\//);
    expectNothingWritten();
  });

  it('acepta una foto valida dentro de assets/', async () => {
    await ctx.service.saveArtist(artistInput({ photo: 'assets/ana.webp' }));

    expect(ctx.repository.records[0].artist.photo).toBe('assets/ana.webp');
  });
});

describe('saveArtist: slug repetido y artista borrado (409 y 404)', () => {
  it('crear con un slug que ya existe es un conflicto y NO sobrescribe al existente', async () => {
    await seed(ctx, 'Ana');
    const before = structuredClone(ctx.repository.records);

    await expect(ctx.service.saveArtist(artistInput({ name: 'Ana', role: 'Otro rol' })))
      .rejects.toThrow(ConflictError);

    expect(ctx.repository.records).toEqual(before);
    expect(ctx.log).not.toContain('repo.updateArtist');
    expect(ctx.log).not.toContain('publisher.publishRoster');
  });

  it('editar con originalSlug actualiza al mismo artista y no crea uno nuevo', async () => {
    await seed(ctx, 'Ana');

    await ctx.service.saveArtist(artistInput({ originalSlug: 'ana', name: 'Ana', role: 'Productora' }));

    expect(ctx.repository.records).toHaveLength(1);
    expect(ctx.repository.records[0].artist.role).toBe('Productora');
    expect(ctx.publisher.published[0].options.message).toBe('Update artist Ana');
  });

  it('editar un artista que ya no existe (otra pestaña lo borro) es 404', async () => {
    await expect(ctx.service.saveArtist(artistInput({ originalSlug: 'fantasma', name: 'Fantasma' })))
      .rejects.toThrow(NotFoundError);
    expect(ctx.log).not.toContain('publisher.publishRoster');
  });

  it('renombrar al slug de OTRO artista es un conflicto', async () => {
    await seed(ctx, 'Ana', 'Beto');

    await expect(ctx.service.saveArtist(artistInput({ originalSlug: 'beto', name: 'Ana' })))
      .rejects.toThrow(ConflictError);
  });

  it('renombrar a un slug libre borra la pagina vieja en el mismo commit', async () => {
    await seed(ctx, 'Ana');

    await ctx.service.saveArtist(artistInput({ originalSlug: 'ana', name: 'Ana Maria', slug: 'ana-maria' }));

    expect(ctx.repository.records[0].artist.slug).toBe('ana-maria');
    expect(ctx.publisher.published[0].options.removedArtistSlugs).toEqual(['ana']);
  });

  it('editar sin cambiar el slug no marca nada para borrar', async () => {
    await seed(ctx, 'Ana');

    await ctx.service.saveArtist(artistInput({ originalSlug: 'ana', name: 'Ana', bio: 'Nueva bio' }));

    expect(ctx.publisher.published[0].options.removedArtistSlugs).toEqual([]);
  });

  it('editar conserva los botones principales que el artista ya habia elegido', async () => {
    await seed(ctx, 'Ana');
    ctx.repository.records[0].artist.heroButtons = { primary: 'spotify', secondary: 'instagram' };

    await ctx.service.saveArtist(artistInput({ originalSlug: 'ana', name: 'Ana' }));

    expect(ctx.repository.records[0].artist.heroButtons).toEqual({ primary: 'spotify', secondary: 'instagram' });
  });

  it('socialOrder null conserva el orden de redes que ya tenia', async () => {
    await seed(ctx, 'Ana');
    ctx.repository.records[0].artist.socialOrder = ['youtube', 'spotify'];

    await ctx.service.saveArtist(artistInput({ originalSlug: 'ana', name: 'Ana', socialOrder: null }));

    expect(ctx.repository.records[0].artist.socialOrder?.slice(0, 2)).toEqual(['youtube', 'spotify']);
  });
});

describe('saveArtist: si publicar falla', () => {
  it('los datos YA quedaron guardados y el error lo dice con claridad (502)', async () => {
    ctx.publisher.failure = new Error('GitHub API 500');

    const error = await ctx.service.saveArtist(artistInput({ name: 'Ana' })).catch(e => e);

    expect(error).toBeInstanceOf(PublishError);
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/quedaron guardados/);
    expect(error.message).toContain('GitHub API 500');
    expect(error.cause).toBe(ctx.publisher.failure);
    expect(ctx.repository.records).toHaveLength(1);
  });

  it('volver a guardar reintenta la publicacion y funciona', async () => {
    ctx.publisher.failure = new Error('GitHub caido');
    await ctx.service.saveArtist(artistInput({ name: 'Ana' })).catch(() => {});

    ctx.publisher.failure = null;
    await ctx.service.saveArtist(artistInput({ originalSlug: 'ana', name: 'Ana' }));

    expect(ctx.repository.records).toHaveLength(1);
    expect(ctx.publisher.published).toHaveLength(1);
  });

  it('si la base falla, NO se publica nada', async () => {
    ctx.repository.failures.insertArtist = new Error('base caida');

    await expect(ctx.service.saveArtist(artistInput({ name: 'Ana' }))).rejects.toThrow('base caida');

    expect(ctx.log).not.toContain('publisher.publishRoster');
  });
});

describe('deleteArtist', () => {
  it('orden: primero retira la pagina publica y DESPUES borra de la base', async () => {
    await seed(ctx, 'Ana');

    await ctx.service.deleteArtist('ana');

    expect(indexOf(ctx.log, 'publisher.publishRoster')).toBeLessThan(indexOf(ctx.log, 'repo.deleteArtistById'));
    expect(ctx.repository.records).toHaveLength(0);
  });

  it('publica el roster SIN el artista y avisa que pagina y lanzamientos se quitan', async () => {
    await seed(ctx, 'Ana', 'Beto');
    ctx.repository.records[0].releases = [
      { title: 'Hit', slug: 'hit', link: 'https://x.co/hit', shareUrl: 'https://lujourban.com/lanzamientos/ana-hit-v1/' }
    ];

    await ctx.service.deleteArtist('ana');

    const { roster, options } = ctx.publisher.published[0];
    expect(roster.data.artists.map(artist => artist.slug)).toEqual(['beto']);
    expect(options.removedArtistSlugs).toEqual(['ana']);
    expect(options.removedReleases).toEqual([
      expect.objectContaining({ slug: 'hit' })
    ]);
  });

  it('si publicar falla NO se borra nada de la base (el artista no queda vivo en la web sin existir en la base)', async () => {
    await seed(ctx, 'Ana');
    ctx.publisher.failure = new Error('GitHub caido');

    const error = await ctx.service.deleteArtist('ana').catch(e => e);

    expect(error).toBeInstanceOf(PublishError);
    expect(error.message).toMatch(/No se borro nada/);
    expect(ctx.log).not.toContain('repo.deleteArtistById');
    expect(ctx.repository.records).toHaveLength(1);
  });

  it('si la base falla despues de publicar, el error se propaga y el artista sigue existiendo', async () => {
    await seed(ctx, 'Ana');
    ctx.repository.failures.deleteArtistById = new Error('base caida');

    await expect(ctx.service.deleteArtist('ana')).rejects.toThrow('base caida');

    expect(ctx.repository.records).toHaveLength(1);
  });

  it('un artista que no existe es 404 y no toca nada', async () => {
    await expect(ctx.service.deleteArtist('fantasma')).rejects.toThrow(NotFoundError);

    expect(ctx.log).not.toContain('publisher.publishRoster');
    expect(ctx.log).not.toContain('repo.deleteArtistById');
  });
});

describe('moveArtist', () => {
  const slugs = () => ctx.repository.records.map(record => record.artist.slug);

  it('sube y baja un artista y publica el nuevo orden', async () => {
    await seed(ctx, 'Ana', 'Beto', 'Caro');

    await ctx.service.moveArtist('caro', 'up');
    expect(slugs()).toEqual(['ana', 'caro', 'beto']);

    await ctx.service.moveArtist('ana', 'down');
    expect(slugs()).toEqual(['caro', 'ana', 'beto']);

    expect(ctx.publisher.published).toHaveLength(2);
    expect(ctx.publisher.published[1].roster.data.artists.map(artist => artist.slug)).toEqual(['caro', 'ana', 'beto']);
  });

  it('en el borde no cambia nada y no publica', async () => {
    await seed(ctx, 'Ana', 'Beto');

    await ctx.service.moveArtist('ana', 'up');
    await ctx.service.moveArtist('beto', 'down');

    expect(slugs()).toEqual(['ana', 'beto']);
    expect(ctx.log).not.toContain('repo.setPositions');
    expect(ctx.publisher.published).toHaveLength(0);
  });

  it('guarda el orden en la base antes de publicar', async () => {
    await seed(ctx, 'Ana', 'Beto');

    await ctx.service.moveArtist('beto', 'up');

    expect(indexOf(ctx.log, 'repo.setPositions')).toBeLessThan(indexOf(ctx.log, 'publisher.publishRoster'));
  });

  it('un slug que no existe es 404', async () => {
    await expect(ctx.service.moveArtist('fantasma', 'up')).rejects.toThrow(NotFoundError);
  });
});

describe('addRelease', () => {
  const release = (overrides = {}) => ({
    artistSlug: 'ana',
    title: 'Mi Cancion',
    slug: '',
    link: 'https://hypeddit.com/ana/mi-cancion',
    cover: '',
    uploadedCover: null,
    ...overrides
  });

  it('crea el lanzamiento, lo marca como actual y publica (en ese orden)', async () => {
    await seed(ctx, 'Ana');

    await ctx.service.addRelease(release({ uploadedCover: { extension: 'jpg', contentBase64: 'BBBB' } }));

    const record = ctx.repository.records[0];
    expect(record.releases.map(item => item.slug)).toEqual(['mi-cancion']);
    expect(record.artist.release?.title).toBe('Mi Cancion');
    expect(record.currentReleaseId).toBe(record.releaseIdsBySlug['mi-cancion']);
    expect(indexOf(ctx.log, 'repo.upsertRelease')).toBeLessThan(indexOf(ctx.log, 'repo.setCurrentRelease'));
    expect(indexOf(ctx.log, 'repo.setCurrentRelease')).toBeLessThan(indexOf(ctx.log, 'publisher.publishRoster'));
  });

  it('la portada subida viaja al commit junto con las paginas de compartir', async () => {
    await seed(ctx, 'Ana');

    await ctx.service.addRelease(release({ uploadedCover: { extension: 'jpg', contentBase64: 'BBBB' } }));

    const paths = (ctx.publisher.published[0].options.extraFiles ?? []).map(file => file.path);
    expect(paths).toContain('assets/ana-mi-cancion-cover.jpg');
    expect(paths.some(path => path.startsWith('lanzamientos/'))).toBe(true);
    expect(paths.some(path => path.startsWith('estados/'))).toBe(true);
  });

  it('sin portada ni link manual, intenta sacarla del smart link', async () => {
    const cover = vi.fn(async () => ({ extension: 'png' as const, contentBase64: 'CCCC' }));
    ctx = makeService({ cover });
    await seed(ctx, 'Ana');

    await ctx.service.addRelease(release());

    expect(cover).toHaveBeenCalledWith('https://hypeddit.com/ana/mi-cancion');
    expect(ctx.repository.records[0].artist.release?.cover).toBe('assets/ana-mi-cancion-cover.png');
  });

  it('si no se encuentra portada, el lanzamiento se crea igual, sin paginas de compartir', async () => {
    await seed(ctx, 'Ana');

    await ctx.service.addRelease(release());

    const created = ctx.repository.records[0].artist.release;
    expect(created?.cover).toBeUndefined();
    expect(created?.shareUrl).toBeUndefined();
    expect(ctx.publisher.published[0].options.extraFiles).toEqual([]);
  });

  it('una portada manual no dispara la busqueda en el smart link', async () => {
    const cover = vi.fn(async () => null);
    ctx = makeService({ cover });
    await seed(ctx, 'Ana');

    await ctx.service.addRelease(release({ cover: 'assets/mi-portada.webp' }));

    expect(cover).not.toHaveBeenCalled();
    expect(ctx.repository.records[0].artist.release?.cover).toBe('assets/mi-portada.webp');
  });

  it('subir otra version del mismo lanzamiento sube el numero de version (v1, v2)', async () => {
    await seed(ctx, 'Ana');
    const cover = { extension: 'jpg' as const, contentBase64: 'BBBB' };

    await ctx.service.addRelease(release({ uploadedCover: cover }));
    expect(ctx.repository.records[0].releases[0].shareUrl).toMatch(/\/lanzamientos\/ana-mi-cancion-v1\/$/);

    // Mismo artista y mismo slug: es el MISMO lanzamiento (un solo registro),
    // pero la pagina de compartir cambia de version para romper el cache de
    // las redes sociales.
    await ctx.service.addRelease(release({ uploadedCover: cover }));
    expect(ctx.repository.records[0].releases).toHaveLength(1);
    expect(ctx.repository.records[0].releases[0].shareUrl).toMatch(/\/lanzamientos\/ana-mi-cancion-v2\/$/);
  });

  it.each([
    ['sin artista', { artistSlug: '' }, /Selecciona un artista/],
    ['sin titulo', { title: '  ' }, /nombre del lanzamiento/],
    ['sin link', { link: '' }, /obligatorio/],
    ['link sin protocolo', { link: 'hypeddit.com/x' }, /enlace completo/],
    ['link javascript:', { link: 'javascript:alert(1)' }, /enlace completo/],
    ['portada fuera de assets/', { cover: 'otra/portada.png' }, /portada debe estar en assets/]
  ])('valida: %s', async (_label, overrides, message) => {
    await seed(ctx, 'Ana');

    await expect(ctx.service.addRelease(release(overrides))).rejects.toThrow(message);

    expect(ctx.log).not.toContain('repo.upsertRelease');
    expect(ctx.log).not.toContain('publisher.publishRoster');
  });

  it('un artista que no existe es 404', async () => {
    await expect(ctx.service.addRelease(release({ artistSlug: 'fantasma' }))).rejects.toThrow(NotFoundError);
  });

  it('si publicar falla, el lanzamiento queda guardado y el error lo avisa', async () => {
    await seed(ctx, 'Ana');
    ctx.publisher.failure = new Error('GitHub caido');

    await expect(ctx.service.addRelease(release())).rejects.toThrow(PublishError);

    expect(ctx.repository.records[0].releases).toHaveLength(1);
  });
});

describe('reactivateRelease', () => {
  const withTwoReleases = async () => {
    await seed(ctx, 'Ana');
    const cover = { extension: 'jpg' as const, contentBase64: 'B' };
    for (const title of ['Primera', 'Segunda']) {
      await ctx.service.addRelease({
        artistSlug: 'ana', title, slug: '', link: 'https://x.co/' + title, cover: '', uploadedCover: cover
      });
    }
    ctx.log.length = 0;
    ctx.publisher.published.length = 0;
  };

  it('vuelve a poner un lanzamiento anterior como el actual y publica', async () => {
    await withTwoReleases();
    expect(ctx.repository.records[0].artist.release?.slug).toBe('segunda');

    await ctx.service.reactivateRelease('ana', 'primera');

    expect(ctx.repository.records[0].artist.release?.slug).toBe('primera');
    expect(ctx.publisher.published[0].options.message).toBe('Reactivate Primera for Ana');
  });

  it('artista o lanzamiento inexistente es 404', async () => {
    await withTwoReleases();

    await expect(ctx.service.reactivateRelease('fantasma', 'primera')).rejects.toThrow(NotFoundError);
    await expect(ctx.service.reactivateRelease('ana', 'no-existe')).rejects.toThrow(NotFoundError);
  });
});

describe('portal del artista: applyPortalInput y savePortalProfile', () => {
  const baseArtist: Artist = {
    name: 'Ana',
    slug: 'ana',
    role: 'Artista oficial',
    tagline: 't',
    links: { spotify: 'https://open.spotify.com/artist/ana' },
    socialOrder: ['spotify', 'instagram'],
    release: { title: 'Hit', slug: 'hit', link: 'https://x.co/hit' }
  };

  const input = (overrides: Partial<PortalInput> = {}): PortalInput => ({
    links: { spotify: 'https://open.spotify.com/artist/ana' },
    socialOrder: ['spotify', 'instagram'],
    heroPrimary: '',
    heroSecondary: '',
    releaseLink: 'https://x.co/hit',
    ...overrides
  });

  it('acepta una entrada valida y deja los botones principales', () => {
    const artist = applyPortalInput(baseArtist, input({ heroPrimary: 'spotify' }));

    expect(artist.heroButtons).toEqual({ primary: 'spotify', secondary: undefined });
  });

  it('NO modifica el artista original (trabaja sobre una copia)', () => {
    const snapshot = structuredClone(baseArtist);

    applyPortalInput(baseArtist, input({ links: { instagram: 'https://instagram.com/ana' } }));

    expect(baseArtist).toEqual(snapshot);
  });

  it('un link vacio quita esa red', () => {
    const artist = applyPortalInput(baseArtist, input({ links: { spotify: '' } }));

    expect(artist.links).toEqual({});
  });

  it('el boton principal necesita que ese link exista', () => {
    expect(() => applyPortalInput(baseArtist, input({ heroPrimary: 'instagram' })))
      .toThrow(/Agrega primero tu enlace de Instagram/);
  });

  it('el boton secundario necesita que ese link exista', () => {
    expect(() => applyPortalInput(baseArtist, input({ heroSecondary: 'youtube' })))
      .toThrow(/botón secundario/);
  });

  it('principal y secundario no pueden ser la misma red', () => {
    expect(() => applyPortalInput(baseArtist, input({ heroPrimary: 'spotify', heroSecondary: 'spotify' })))
      .toThrow(/dos redes diferentes/);
  });

  it('el boton con una red inexistente se rechaza', () => {
    expect(() => applyPortalInput(baseArtist, input({ heroPrimary: 'myspace' })))
      .toThrow(/no es una red valida/);
  });

  it('el enlace de la cancion actual es obligatorio si el artista tiene una', () => {
    expect(() => applyPortalInput(baseArtist, input({ releaseLink: '' }))).toThrow(/obligatorio/);
  });

  it('un artista sin cancion actual no necesita ese enlace', () => {
    expect(() => applyPortalInput({ ...baseArtist, release: null }, input({ releaseLink: '' }))).not.toThrow();
  });

  it.each(['javascript:alert(1)', 'sin-protocolo.com', 'ftp://x.co/a'])('rechaza el link %s', url => {
    expect(() => applyPortalInput(baseArtist, input({ links: { spotify: url } }))).toThrow(ValidationError);
  });

  describe('savePortalProfile', () => {
    const seedWithRelease = async () => {
      await seed(ctx, 'Ana');
      await ctx.service.addRelease({
        artistSlug: 'ana', title: 'Hit', slug: '', link: 'https://x.co/hit', cover: '',
        uploadedCover: { extension: 'jpg', contentBase64: 'B' }
      });
      await ctx.service.saveArtist(artistInput({
        originalSlug: 'ana', name: 'Ana', links: { spotify: 'https://open.spotify.com/artist/ana' }
      }));
      ctx.log.length = 0;
      ctx.publisher.published.length = 0;
    };

    it('guarda los campos del portal y publica; devuelve antes y despues', async () => {
      await seedWithRelease();

      const { before, after } = await ctx.service.savePortalProfile('ana', input({
        heroPrimary: 'spotify',
        links: { spotify: 'https://open.spotify.com/artist/ana', instagram: 'https://instagram.com/ana' }
      }));

      expect(before.links).toEqual({ spotify: 'https://open.spotify.com/artist/ana' });
      expect(after.links).toHaveProperty('instagram');
      expect(ctx.repository.records[0].artist.heroButtons?.primary).toBe('spotify');
      expect(ctx.publisher.published).toHaveLength(1);
    });

    it('solo actualiza el enlace de la cancion cuando de verdad cambio', async () => {
      await seedWithRelease();

      await ctx.service.savePortalProfile('ana', input({ releaseLink: 'https://x.co/hit' }));
      expect(ctx.log).not.toContain('repo.updateReleaseLink');

      await ctx.service.savePortalProfile('ana', input({ releaseLink: 'https://x.co/nuevo' }));
      expect(ctx.log).toContain('repo.updateReleaseLink');
      expect(ctx.repository.records[0].artist.release?.link).toBe('https://x.co/nuevo');
    });

    it('si la validacion falla no se escribe nada', async () => {
      await seedWithRelease();

      await expect(ctx.service.savePortalProfile('ana', input({ heroPrimary: 'youtube' }))).rejects.toThrow(ValidationError);

      expect(ctx.log).not.toContain('repo.updatePortalFields');
      expect(ctx.log).not.toContain('publisher.publishRoster');
    });

    it('una cuenta que ya no esta vinculada a un perfil es 404', async () => {
      await expect(ctx.service.savePortalProfile('fantasma', input())).rejects.toThrow(NotFoundError);
    });
  });
});

describe('catalogo de Casa', () => {
  it('publica el catalogo con el roster actual', async () => {
    await seed(ctx, 'Ana');

    await ctx.service.publishCasaCatalog({ picks: [] }, 'Update catalog');

    expect(ctx.publisher.casaPublished).toHaveLength(1);
    expect(ctx.publisher.casaPublished[0].message).toBe('Update catalog');
    expect(ctx.publisher.casaPublished[0].roster.data.artists).toHaveLength(1);
  });

  it('si falla, el error es de publicacion (502)', async () => {
    ctx.publisher.failure = new Error('GitHub caido');

    const error = await ctx.service.publishCasaCatalog({ picks: [] }, 'Update catalog').catch(e => e);

    expect(error).toBeInstanceOf(PublishError);
    expect(error.message).toContain('GitHub caido');
  });
});

describe('lecturas', () => {
  it('loadRoster arma el roster y el historial solo con los artistas que tienen lanzamientos', async () => {
    await seed(ctx, 'Ana', 'Beto');
    ctx.repository.records[0].releases = [{ title: 'Hit', slug: 'hit', link: 'https://x.co/hit' }];

    const roster = await ctx.service.loadRoster();

    expect(roster.data.artists.map(artist => artist.slug)).toEqual(['ana', 'beto']);
    expect(Object.keys(roster.history.artists)).toEqual(['ana']);
  });

  it('findArtistBySlug devuelve el artista o null', async () => {
    await seed(ctx, 'Ana');

    expect((await ctx.service.findArtistBySlug('ana'))?.artist.name).toBe('Ana');
    expect(await ctx.service.findArtistBySlug('fantasma')).toBeNull();
  });
});
