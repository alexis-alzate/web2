import { describe, expect, it } from 'vitest';
import {
  MAX_PAST_RELEASES,
  buildArtistFiles,
  pastReleasesOf,
  renderArtistPage,
  type Artist,
  type ArtistRelease
} from '@/lib/artist-renderer';

const release = (slug: string, overrides: Partial<ArtistRelease> = {}): ArtistRelease => ({
  title: slug.toUpperCase(),
  slug,
  link: `https://too.fm/${slug}`,
  cover: `assets/ana-${slug}-cover.jpg`,
  ...overrides
});

const artist = (overrides: Partial<Artist> = {}): Artist => ({
  name: 'ANA',
  slug: 'ana',
  role: 'Artista oficial',
  tagline: 'Prueba',
  links: {},
  release: release('tres'),
  ...overrides
});

// El historial llega del mas viejo al mas nuevo e incluye el lanzamiento actual.
const history = [release('uno'), release('dos'), release('tres')];

describe('pastReleasesOf', () => {
  it('devuelve los anteriores, del mas nuevo al mas viejo, sin el actual', () => {
    expect(pastReleasesOf(artist(), history).map(item => item.slug)).toEqual(['dos', 'uno']);
  });

  it('con un solo lanzamiento (el actual) no hay nada que mostrar', () => {
    expect(pastReleasesOf(artist(), [release('tres')])).toEqual([]);
    expect(pastReleasesOf(artist(), [])).toEqual([]);
  });

  it('sin lanzamiento actual muestra todo el historial', () => {
    expect(pastReleasesOf(artist({ release: null }), history).map(item => item.slug)).toEqual(['tres', 'dos', 'uno']);
  });

  it('ignora repetidos y los que no tienen titulo o enlace', () => {
    const messy = [release('uno'), release('uno'), release('sin-link', { link: '' }), release('sin-titulo', { title: '' }), release('tres')];
    expect(pastReleasesOf(artist(), messy).map(item => item.slug)).toEqual(['uno']);
  });

  it('reconoce el actual aunque el historial no traiga slug', () => {
    const noSlug = [{ title: 'Uno', link: 'https://too.fm/uno' }, { title: 'TRES', link: 'https://too.fm/tres' }];
    expect(pastReleasesOf(artist(), noSlug).map(item => item.title)).toEqual(['Uno']);
  });

  it(`muestra como maximo ${MAX_PAST_RELEASES}`, () => {
    const many = Array.from({ length: 20 }, (_, index) => release(`r${index}`));
    const shown = pastReleasesOf(artist(), many);
    expect(shown).toHaveLength(MAX_PAST_RELEASES);
    expect(shown[0].slug).toBe('r19');
  });
});

describe('seccion "Más música" en la pagina del artista', () => {
  it('no aparece si no hay lanzamientos anteriores', () => {
    expect(renderArtistPage(artist(), [release('tres')])).not.toContain('more-music');
    expect(renderArtistPage(artist())).not.toContain('more-music');
  });

  it('lista los anteriores debajo del ultimo lanzamiento, cada uno con su enlace y portada', () => {
    const html = renderArtistPage(artist(), history);

    expect(html.indexOf('release-card')).toBeLessThan(html.indexOf('more-music-list'));
    expect(html.indexOf('more-music-title">DOS<')).toBeLessThan(html.indexOf('more-music-title">UNO<'));
    expect(html).toContain('href="https://too.fm/dos"');
    expect(html).toContain('src="/assets/ana-dos-cover.jpg"');
    expect(html.match(/class="more-music-row"/g)).toHaveLength(2);
  });

  it('cuenta el toque como una escucha de ESE lanzamiento', () => {
    const html = renderArtistPage(artist(), history);

    expect(html).toMatch(/class="more-music-row" data-artist-release-status data-release-slug="dos" data-artist-slug="ana"/);
  });

  it('sin portada usa las iniciales, y escapa el titulo', () => {
    const html = renderArtistPage(artist(), [release('x', { title: 'Uno <b>dos</b>', cover: undefined }), release('tres')]);

    expect(html).toContain('more-music-cover-empty');
    expect(html).toContain('Uno &lt;b&gt;dos&lt;/b&gt;');
    expect(html).not.toContain('<b>dos</b>');
  });
});

describe('buildArtistFiles', () => {
  it('le pasa a cada pagina el historial de SU artista', () => {
    const files = buildArtistFiles(
      { artists: [artist(), artist({ slug: 'beto', name: 'BETO', release: null })] },
      '<urlset></urlset>',
      undefined,
      { ana: history, beto: [] }
    );
    const page = (slug: string) => files.find(file => file.path === `artistas/${slug}/index.html`)!.content;

    expect(page('ana')).toContain('more-music-list');
    expect(page('beto')).not.toContain('more-music-list');
  });
});
