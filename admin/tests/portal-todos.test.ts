import { describe, expect, it } from 'vitest';
import type { Artist, ArtistRelease } from '@/lib/artist-renderer';
import { summarizeArtistStats } from '@/lib/artist-stats';
import { comparableLink, duplicatedReleaseLinks, portalTodos } from '@/lib/portal-todos';

const release = (slug: string, link: string, cover: string | undefined = `assets/${slug}.jpg`): ArtistRelease =>
  ({ title: slug.toUpperCase(), slug, link, cover });

const artist = (overrides: Partial<Artist> = {}): Artist => ({
  name: 'ANA',
  slug: 'ana',
  role: 'Artista oficial',
  tagline: 't',
  photo: 'assets/ana.jpg',
  links: { spotify: 'https://open.spotify.com/artist/1', instagram: 'https://instagram.com/ana' },
  release: release('dos', 'https://too.fm/dos'),
  ...overrides
});

describe('comparableLink', () => {
  it('ignora los parámetros de seguimiento y el www', () => {
    expect(comparableLink('https://youtu.be/rJ3rmvjncLM?si=mvwOJOHdWXR0XdGl'))
      .toBe(comparableLink('https://youtu.be/rJ3rmvjncLM?si=r4yxmmg5307iIaJ2'));
    expect(comparableLink('https://www.open.spotify.com/track/1?utm_source=x&si=2'))
      .toBe(comparableLink('https://open.spotify.com/track/1/'));
  });

  it('distingue videos distintos de YouTube', () => {
    expect(comparableLink('https://www.youtube.com/watch?v=AAA&si=1'))
      .not.toBe(comparableLink('https://www.youtube.com/watch?v=BBB&si=1'));
  });

  it('lo que no es enlace queda vacío', () => {
    expect(comparableLink('hola')).toBe('');
    expect(comparableLink(undefined)).toBe('');
  });
});

describe('duplicatedReleaseLinks', () => {
  it('marca las dos canciones que comparten enlace, con el nombre de la otra', () => {
    const duplicated = duplicatedReleaseLinks([
      release('uno', 'https://youtu.be/X?si=1'),
      release('dos', 'https://youtu.be/X?si=2'),
      release('tres', 'https://youtu.be/Y')
    ]);

    expect(Array.from(duplicated.entries())).toEqual([['uno', 'DOS'], ['dos', 'UNO']]);
  });

  it('sin repetidos no marca nada', () => {
    expect(duplicatedReleaseLinks([release('uno', 'https://a.co/1'), release('dos', 'https://a.co/2')]).size).toBe(0);
  });
});

describe('portalTodos', () => {
  it('un perfil completo no tiene pendientes', () => {
    expect(portalTodos(artist(), [release('dos', 'https://too.fm/dos')])).toEqual([]);
  });

  it('avisa lo que falta, cada cosa con su lugar', () => {
    const todos = portalTodos(
      artist({ photo: undefined, links: {}, release: release('dos', 'https://too.fm/x', '') }),
      [release('uno', 'https://too.fm/x'), release('dos', 'https://too.fm/x', '')]
    );

    expect(todos.map(todo => [todo.key, todo.href])).toEqual([
      ['photo', '/mi-perfil/pagina'],
      ['cover', '/mi-perfil/musica'],
      ['duplicate-link', '/mi-perfil/musica'],
      ['links', '/mi-perfil/pagina']
    ]);
  });

  it('sin canción pide publicar la primera', () => {
    expect(portalTodos(artist({ release: null }), []).map(todo => todo.key)).toEqual(['release']);
  });
});

describe('escuchas por canción', () => {
  const now = new Date('2026-11-13T17:00:00Z');
  const listen = (release_slug: string | null, created_at = '2026-11-10T15:00:00Z') =>
    ({ event_type: 'status_click', release_slug, referrer: '', source_url: '', created_at });

  it('cuenta por canción dentro del periodo, de mayor a menor', () => {
    const stats = summarizeArtistStats([
      listen('uno'), listen('dos'), listen('dos'), listen(null),
      listen('viejo', '2026-09-20T15:00:00Z'),
      { event_type: 'view', release_slug: 'dos', referrer: '', source_url: '', created_at: '2026-11-10T15:00:00Z' }
    ], now);

    expect(stats.songs).toEqual([{ slug: 'dos', listens: 2 }, { slug: 'uno', listens: 1 }]);
    expect(stats.listens).toBe(4);
  });

  it('sin escuchas la lista queda vacía', () => {
    expect(summarizeArtistStats([], now).songs).toEqual([]);
  });
});
