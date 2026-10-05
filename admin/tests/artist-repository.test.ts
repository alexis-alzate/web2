import { describe, expect, it } from 'vitest';
import { SupabaseArtistRepository } from '@/lib/artists/repository';
import type { ArtistWrite, ReleaseWrite } from '@/lib/artists/types';
import { isAppError, ConflictError, ValidationError } from '@/lib/errors';
import { fakeSupabase, type DbResult } from './fake-supabase';

const repositoryWith = (responses: Record<string, DbResult | ((call: never) => DbResult)> = {}) => {
  const db = fakeSupabase(responses as never);
  return { ...db, repository: new SupabaseArtistRepository(() => db.client) };
};

const write: ArtistWrite = {
  slug: 'ana',
  name: 'Ana',
  cardName: 'Ana',
  role: 'Artista oficial',
  tagline: 't',
  bio: 'b',
  photoPath: 'assets/ana.png',
  socialOrder: ['spotify', 'instagram'],
  heroPrimary: 'spotify',
  heroSecondary: null,
  beatsEmbedUrl: null,
  productionsEmbedUrl: null,
  contactLabel: 'Booking',
  contactUrl: 'https://wa.me/57300'
};

const artistRow = (overrides = {}) => ({
  id: 'a1',
  slug: 'ana',
  name: 'Ana',
  card_name: 'Ana',
  role: 'Artista oficial',
  tagline: 't',
  bio: 'b',
  photo_path: 'assets/ana.png',
  social_order: ['spotify', 'instagram'],
  hero_primary: null,
  hero_secondary: null,
  beats_embed_url: null,
  productions_embed_url: null,
  contact_label: null,
  contact_url: null,
  position: 0,
  current_release_id: null,
  ...overrides
});

describe('listArtists', () => {
  it('une artistas, links y lanzamientos en memoria y arma el registro', async () => {
    const { repository } = repositoryWith({
      'artists:select': {
        data: [
          artistRow({ id: 'a1', slug: 'ana', current_release_id: 'r2', hero_primary: 'spotify' }),
          artistRow({ id: 'a2', slug: 'beto', name: 'Beto' })
        ]
      },
      'artist_links:select': {
        data: [
          { artist_id: 'a1', network: 'spotify', url: 'https://open.spotify.com/a' },
          { artist_id: 'a2', network: 'instagram', url: 'https://instagram.com/b' }
        ]
      },
      'artist_releases:select': {
        data: [
          { id: 'r1', artist_id: 'a1', slug: 'viejo', title: 'Viejo', link: 'https://x.co/1', cover_path: null, share_url: null, status_url: null },
          { id: 'r2', artist_id: 'a1', slug: 'nuevo', title: 'Nuevo', link: 'https://x.co/2', cover_path: 'assets/n.jpg', share_url: 'https://s', status_url: 'https://t' }
        ]
      }
    });

    const [ana, beto] = await repository.listArtists();

    expect(ana.id).toBe('a1');
    expect(ana.artist.links).toEqual({ spotify: 'https://open.spotify.com/a' });
    expect(beto.artist.links).toEqual({ instagram: 'https://instagram.com/b' });
    expect(ana.releases.map(release => release.slug)).toEqual(['viejo', 'nuevo']);
    expect(ana.releaseIdsBySlug).toEqual({ viejo: 'r1', nuevo: 'r2' });
    expect(ana.currentReleaseId).toBe('r2');
    expect(ana.artist.release).toMatchObject({ slug: 'nuevo', cover: 'assets/n.jpg', shareUrl: 'https://s', statusUrl: 'https://t' });
    expect(beto.artist.release).toBeNull();
    expect(beto.releases).toEqual([]);
  });

  it('pide los artistas ordenados por posicion y los lanzamientos por fecha', async () => {
    const { repository, on, methods } = repositoryWith({ 'artists:select': { data: [] } });

    await repository.listArtists();

    expect(methods(on('artists')[0])).toEqual(['select', 'order', 'order']);
    expect(on('artists')[0].ops[1].args).toEqual(['position', { ascending: true }]);
    expect(on('artist_releases')[0].ops.map(op => op.method)).toContain('order');
  });

  it('los campos vacios de la base salen como espera el renderizador', async () => {
    const { repository } = repositoryWith({ 'artists:select': { data: [artistRow()] } });

    const [record] = await repository.listArtists();

    expect(record.artist.beatsEmbed).toBe('');
    expect(record.artist.productionsEmbed).toBe('');
    expect(record.artist.contact).toBeNull();
    expect(record.artist.heroButtons).toBeUndefined();
  });

  it('ignora redes que no son validas (en el orden y en los botones principales)', async () => {
    const { repository } = repositoryWith({
      'artists:select': {
        data: [artistRow({ social_order: ['spotify', 'myspace'], hero_primary: 'myspace', hero_secondary: 'instagram' })]
      }
    });

    const [record] = await repository.listArtists();

    expect(record.artist.socialOrder).toEqual(['spotify']);
    expect(record.artist.heroButtons).toEqual({ primary: undefined, secondary: 'instagram' });
  });

  it('devuelve lista vacia si no hay artistas', async () => {
    const { repository } = repositoryWith({ 'artists:select': { data: null } });

    expect(await repository.listArtists()).toEqual([]);
  });

  it.each([
    ['artists:select', /leer los artistas/],
    ['artist_links:select', /leer los links/],
    ['artist_releases:select', /leer los lanzamientos/]
  ])('si falla la consulta %s, el error lo dice', async (key, message) => {
    const { repository } = repositoryWith({ [key]: { error: { message: 'boom' } } });

    await expect(repository.listArtists()).rejects.toThrow(message);
  });
});

// Las reglas (slug unico, URLs https, extensiones) las hace cumplir la base
// de datos; el repositorio solo traduce el error de Postgres a uno con tipo.
describe('traduccion de errores de Postgres', () => {
  it('23505 (valor duplicado) pasa a ConflictError (409) y conserva la causa', async () => {
    const dbError = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const { repository } = repositoryWith({
      'artists:select': { data: null },
      'artists:insert': { error: dbError }
    });

    const error = await repository.insertArtist(write).catch(e => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/ya existe un registro con ese slug/);
    expect(error.cause).toBe(dbError);
  });

  it('23514 (check constraint) pasa a ValidationError (400) con el motivo de la base', async () => {
    const { repository } = repositoryWith({
      'artists:update': { error: { code: '23514', message: 'violates check constraint "photo_path"' } }
    });

    const error = await repository.updateArtist('a1', write).catch(e => e);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.status).toBe(400);
    expect(error.message).toContain('photo_path');
  });

  it('cualquier otro error de base es inesperado: Error normal, NO AppError, con su causa', async () => {
    const dbError = { code: '57P01', message: 'terminating connection' };
    const { repository } = repositoryWith({ 'artists:delete': { error: dbError } });

    const error = await repository.deleteArtistById('a1').catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(isAppError(error)).toBe(false);
    expect(error.cause).toBe(dbError);
  });
});

describe('insertArtist', () => {
  it('crea al final del roster: posicion = ultima + 1, y devuelve el id', async () => {
    const { repository, on } = repositoryWith({
      'artists:select': { data: { position: 4 } },
      'artists:insert': { data: { id: 'nuevo-id' } }
    });

    const id = await repository.insertArtist(write);

    expect(id).toBe('nuevo-id');
    const insert = on('artists')[1].ops.find(op => op.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ slug: 'ana', position: 5 });
  });

  it('el primer artista queda en la posicion 0', async () => {
    const { repository, on } = repositoryWith({
      'artists:select': { data: null },
      'artists:insert': { data: { id: 'x' } }
    });

    await repository.insertArtist(write);

    const insert = on('artists')[1].ops.find(op => op.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ position: 0 });
  });

  it('guarda las columnas con nombres de la base (snake_case)', async () => {
    const { repository, on } = repositoryWith({
      'artists:select': { data: null },
      'artists:insert': { data: { id: 'x' } }
    });

    await repository.insertArtist(write);

    const insert = on('artists')[1].ops.find(op => op.method === 'insert');
    expect(insert?.args[0]).toEqual({
      slug: 'ana',
      name: 'Ana',
      card_name: 'Ana',
      role: 'Artista oficial',
      tagline: 't',
      bio: 'b',
      photo_path: 'assets/ana.png',
      social_order: ['spotify', 'instagram'],
      hero_primary: 'spotify',
      hero_secondary: null,
      beats_embed_url: null,
      productions_embed_url: null,
      contact_label: 'Booking',
      contact_url: 'https://wa.me/57300',
      position: 0
    });
  });

  it('si la base no devuelve el id, falla con un error claro', async () => {
    const { repository } = repositoryWith({
      'artists:select': { data: null },
      'artists:insert': { data: null }
    });

    await expect(repository.insertArtist(write)).rejects.toThrow(/crear el artista/);
  });

  it('si falla calcular la posicion, no intenta insertar', async () => {
    const { repository, on } = repositoryWith({ 'artists:select': { error: { message: 'boom' } } });

    await expect(repository.insertArtist(write)).rejects.toThrow(/posicion/);

    expect(on('artists')).toHaveLength(1);
  });
});

describe('replaceLinks', () => {
  it('primero agrega o actualiza los nuevos y DESPUES quita los que sobran (un fallo a medias nunca borra sin reemplazo)', async () => {
    const { repository, on, methods } = repositoryWith();

    await repository.replaceLinks('a1', { spotify: 'https://s', instagram: 'https://i' });

    const [upsert, removal] = on('artist_links');
    expect(methods(upsert)[0]).toBe('upsert');
    expect(upsert.ops[0].args[0]).toEqual([
      { artist_id: 'a1', network: 'spotify', url: 'https://s' },
      { artist_id: 'a1', network: 'instagram', url: 'https://i' }
    ]);
    expect(upsert.ops[0].args[1]).toEqual({ onConflict: 'artist_id,network' });
    expect(methods(removal)).toEqual(['delete', 'eq', 'not']);
    expect(removal.ops[2].args).toEqual(['network', 'in', '(spotify,instagram)']);
  });

  it('sin links, solo borra todos los del artista (no hace upsert)', async () => {
    const { repository, on, methods } = repositoryWith();

    await repository.replaceLinks('a1', {});

    expect(on('artist_links')).toHaveLength(1);
    expect(methods(on('artist_links')[0])).toEqual(['delete', 'eq']);
  });

  it('si el upsert falla, NO borra nada', async () => {
    const { repository, on } = repositoryWith({ 'artist_links:upsert': { error: { message: 'boom' } } });

    await expect(repository.replaceLinks('a1', { spotify: 'https://s' })).rejects.toThrow(/guardar los links/);

    expect(on('artist_links')).toHaveLength(1);
  });

  it('si falla quitar los antiguos, el error lo dice', async () => {
    const { repository } = repositoryWith({ 'artist_links:delete': { error: { message: 'boom' } } });

    await expect(repository.replaceLinks('a1', {})).rejects.toThrow(/quitar links antiguos/);
  });
});

describe('setPositions', () => {
  it('guarda la posicion de cada artista segun su lugar en la lista', async () => {
    const { repository, on } = repositoryWith();

    await repository.setPositions(['c', 'a', 'b']);

    const updates = on('artists').map(call => ({
      payload: call.ops[0].args[0],
      id: call.ops.find(op => op.method === 'eq')?.args[1]
    }));
    expect(updates).toEqual([
      { payload: { position: 0 }, id: 'c' },
      { payload: { position: 1 }, id: 'a' },
      { payload: { position: 2 }, id: 'b' }
    ]);
  });

  it('si alguna actualizacion falla, lanza error', async () => {
    const { repository } = repositoryWith({ 'artists:update': { error: { message: 'boom' } } });

    await expect(repository.setPositions(['a', 'b'])).rejects.toThrow(/reordenar/);
  });
});

describe('lanzamientos', () => {
  const releaseWrite: ReleaseWrite = {
    slug: 'hit', title: 'Hit', link: 'https://x.co/hit', coverPath: 'assets/hit.jpg', shareUrl: 's', statusUrl: 't'
  };

  it('upsertRelease usa artista + slug como clave y devuelve el id', async () => {
    const { repository, on } = repositoryWith({ 'artist_releases:upsert': { data: { id: 'r9' } } });

    const id = await repository.upsertRelease('a1', releaseWrite);

    expect(id).toBe('r9');
    const upsert = on('artist_releases')[0].ops[0];
    expect(upsert.args[0]).toEqual({
      artist_id: 'a1', slug: 'hit', title: 'Hit', link: 'https://x.co/hit',
      cover_path: 'assets/hit.jpg', share_url: 's', status_url: 't'
    });
    expect(upsert.args[1]).toEqual({ onConflict: 'artist_id,slug' });
  });

  it('upsertRelease sin respuesta falla con un error claro', async () => {
    const { repository } = repositoryWith({ 'artist_releases:upsert': { data: null } });

    await expect(repository.upsertRelease('a1', releaseWrite)).rejects.toThrow(/guardar el lanzamiento/);
  });

  it('setCurrentRelease y updateReleaseLink escriben donde corresponde', async () => {
    const { repository, on } = repositoryWith();

    await repository.setCurrentRelease('a1', 'r1');
    await repository.updateReleaseLink('r1', 'https://x.co/nuevo');

    expect(on('artists')[0].ops[0].args[0]).toEqual({ current_release_id: 'r1' });
    expect(on('artist_releases')[0].ops[0].args[0]).toEqual({ link: 'https://x.co/nuevo' });
  });
});

describe('updatePortalFields', () => {
  it('solo escribe los tres campos que el artista puede editar', async () => {
    const { repository, on } = repositoryWith();

    await repository.updatePortalFields('a1', { socialOrder: ['spotify'], heroPrimary: 'spotify', heroSecondary: null });

    expect(on('artists')[0].ops[0].args[0]).toEqual({
      social_order: ['spotify'], hero_primary: 'spotify', hero_secondary: null
    });
  });

  it('un error de base se traduce con el mensaje del portal', async () => {
    const { repository } = repositoryWith({ 'artists:update': { error: { message: 'boom' } } });

    await expect(repository.updatePortalFields('a1', { socialOrder: [], heroPrimary: null, heroSecondary: null }))
      .rejects.toThrow(/guardar tu perfil/);
  });
});
