import { describe, expect, it } from 'vitest';
import { renderArtistPage, type Artist } from '@/lib/artist-renderer';
import { summarizeArtistStats } from '@/lib/artist-stats';
import { ValidationError } from '@/lib/errors';
import { parseLinkClick, summarizeLinkClicks } from '@/lib/link-clicks';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148';
const valid = { artist_slug: 'la-libreta', link_key: 'spotify', placement: 'hero' };

describe('parseLinkClick', () => {
  it('acepta un clic valido y deduce el dispositivo', () => {
    expect(parseLinkClick(valid, IPHONE)).toEqual({
      artist_slug: 'la-libreta',
      link_key: 'spotify',
      placement: 'hero',
      device_type: 'mobile',
      user_agent: IPHONE
    });
  });

  it('respeta el dispositivo que manda la pagina si es uno permitido', () => {
    expect(parseLinkClick({ ...valid, device_type: 'tablet' }, IPHONE).device_type).toBe('tablet');
    expect(parseLinkClick({ ...valid, device_type: 'nevera' }, IPHONE).device_type).toBe('mobile');
    expect(parseLinkClick(valid, null).device_type).toBe('desktop');
  });

  it('recorta un user-agent demasiado largo', () => {
    expect(parseLinkClick(valid, 'x'.repeat(900)).user_agent).toHaveLength(300);
  });

  it.each([
    ['sin artista', { ...valid, artist_slug: '' }],
    ['slug con mayusculas', { ...valid, artist_slug: 'La-Libreta' }],
    ['slug con caracteres raros', { ...valid, artist_slug: "x'; drop table artists;--" }],
    ['slug demasiado largo', { ...valid, artist_slug: 'a'.repeat(91) }],
    ['slug que no es texto', { ...valid, artist_slug: 42 }],
    ['red desconocida', { ...valid, link_key: 'onlyfans' }],
    ['red vacia', { ...valid, link_key: '' }],
    ['ubicacion desconocida', { ...valid, placement: 'footer' }],
    ['cuerpo que no es objeto', 'hola'],
    ['cuerpo nulo', null]
  ])('rechaza: %s', (_name, payload) => {
    expect(() => parseLinkClick(payload, IPHONE)).toThrow(ValidationError);
  });
});

describe('summarizeLinkClicks', () => {
  const since = new Date('2026-10-15T05:00:00Z');
  const now = new Date('2026-11-13T17:00:00Z');
  const click = (link_key: string | null, created_at = '2026-11-10T15:00:00Z') => ({ link_key, created_at });

  it('cuenta por red y ordena de mayor a menor', () => {
    const stats = summarizeLinkClicks(
      [click('instagram'), click('spotify'), click('spotify'), click('spotify'), click('instagram'), click('tiktok')],
      since,
      now
    );
    expect(stats).toEqual([
      { key: 'spotify', label: 'Spotify', clicks: 3 },
      { key: 'instagram', label: 'Instagram', clicks: 2 },
      { key: 'tiktok', label: 'TikTok', clicks: 1 }
    ]);
  });

  it('en un empate conserva el orden fijo de las redes', () => {
    const stats = summarizeLinkClicks([click('whatsapp'), click('tiktok'), click('youtube')], since, now);
    expect(stats.map(item => item.key)).toEqual(['tiktok', 'youtube', 'whatsapp']);
  });

  it('ignora lo que esta fuera del periodo, redes desconocidas y fechas rotas', () => {
    const stats = summarizeLinkClicks([
      click('spotify', '2026-10-14T23:00:00Z'),
      click('spotify', '2026-11-14T00:00:00Z'),
      click('myspace'),
      click(null),
      click('spotify', 'no-es-fecha')
    ], since, now);
    expect(stats).toEqual([]);
  });
});

describe('summarizeArtistStats con clics por enlace', () => {
  const now = new Date('2026-11-13T17:00:00Z');

  it('sin clics deja la lista vacia', () => {
    expect(summarizeArtistStats([], now).links).toEqual([]);
    expect(summarizeArtistStats([], now).hasData).toBe(false);
  });

  it('usa los mismos 30 dias de calendario de Bogota que la grafica', () => {
    const stats = summarizeArtistStats([], now, [
      // 15 de octubre 00:30 en Bogota: primer dia de la grafica, entra.
      { link_key: 'spotify', created_at: '2026-10-15T05:30:00Z' },
      // 14 de octubre 23:30 en Bogota: un dia antes, no entra.
      { link_key: 'spotify', created_at: '2026-10-15T04:30:00Z' },
      { link_key: 'instagram', created_at: '2026-11-13T16:00:00Z' }
    ]);
    expect(stats.daily[0].date).toBe('2026-10-15');
    expect(stats.links).toEqual([
      { key: 'spotify', label: 'Spotify', clicks: 1 },
      { key: 'instagram', label: 'Instagram', clicks: 1 }
    ]);
    expect(stats.hasData).toBe(true);
  });
});

describe('pagina publica del artista', () => {
  const artist: Artist = {
    name: 'ANA',
    slug: 'ana',
    role: 'Artista oficial',
    tagline: 'Prueba',
    links: { spotify: 'https://open.spotify.com/artist/1', instagram: 'https://instagram.com/ana' },
    heroButtons: { primary: 'spotify' }
  };
  const html = renderArtistPage(artist);

  it('marca los botones de arriba y la cuadricula para contar los clics', () => {
    expect(html).toContain('data-artist-link="spotify" data-link-place="hero" data-artist-slug="ana"');
    expect(html).toContain('data-artist-link="spotify" data-link-place="grid" data-artist-slug="ana"');
    expect(html).toContain('data-artist-link="instagram" data-link-place="grid" data-artist-slug="ana"');
  });

  it('incluye el envio al endpoint de clics', () => {
    expect(html).toContain('https://admin.lujourban.com/api/analytics/link-click');
    expect(html).toContain("document.querySelectorAll('[data-artist-link]')");
  });
});
