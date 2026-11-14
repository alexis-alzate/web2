import { describe, expect, it } from 'vitest';
import { classifySource, summarizeArtistStats, type ArtistStatsRow } from '@/lib/artist-stats';

// Mediodia en Bogota del 13 de noviembre de 2026.
const NOW = new Date('2026-11-13T17:00:00Z');
const PAGE = 'https://www.lujourban.com/artistas/ana/';

const row = (overrides: Partial<ArtistStatsRow> = {}): ArtistStatsRow => ({
  event_type: 'view',
  referrer: '',
  source_url: PAGE,
  created_at: '2026-11-13T15:00:00Z',
  ...overrides
});

describe('classifySource', () => {
  it('sin referente es enlace directo', () => {
    expect(classifySource({ referrer: '', source_url: PAGE })).toBe('direct');
    expect(classifySource({ referrer: null, source_url: null })).toBe('direct');
  });

  it('reconoce las redes por el sitio de origen', () => {
    expect(classifySource({ referrer: 'https://l.instagram.com/', source_url: PAGE })).toBe('instagram');
    expect(classifySource({ referrer: 'https://m.facebook.com/x', source_url: PAGE })).toBe('facebook');
    expect(classifySource({ referrer: 'https://www.tiktok.com/', source_url: PAGE })).toBe('tiktok');
    expect(classifySource({ referrer: 'https://casa.lujourban.com/', source_url: PAGE })).toBe('lujourban');
    expect(classifySource({ referrer: 'https://www.google.com.co/', source_url: PAGE })).toBe('google');
  });

  it('la etiqueta utm_source del enlace manda sobre el sitio de origen', () => {
    expect(classifySource({ referrer: '', source_url: `${PAGE}?utm_source=ig` })).toBe('instagram');
    expect(classifySource({ referrer: 'https://www.lujourban.com/', source_url: `${PAGE}?utm_source=whatsapp` })).toBe('whatsapp');
  });

  it('un sitio desconocido o un valor que no es URL no rompe nada', () => {
    expect(classifySource({ referrer: 'https://blog.ejemplo.co/post', source_url: PAGE })).toBe('other');
    expect(classifySource({ referrer: 'no-es-url', source_url: 'tampoco' })).toBe('direct');
    // Un dominio que solo "contiene" el nombre no cuenta como la red.
    expect(classifySource({ referrer: 'https://instagram.com.malo.co/', source_url: PAGE })).toBe('other');
  });
});

describe('summarizeArtistStats', () => {
  it('sin eventos devuelve 30 dias en cero y hasData false', () => {
    const stats = summarizeArtistStats([], NOW);

    expect(stats.daily).toHaveLength(30);
    expect(stats.daily.at(-1)?.date).toBe('2026-11-13');
    expect(stats.daily[0].date).toBe('2026-10-15');
    expect(stats).toMatchObject({ visitors: 0, listens: 0, shares: 0, hasData: false, failed: false, sources: [] });
  });

  it('cuenta visitas, escuchas y compartidos del periodo', () => {
    const stats = summarizeArtistStats([
      row(), row(), row({ event_type: 'status_click' }), row({ event_type: 'chat_click' }),
      row({ event_type: 'otro' }), row({ event_type: null })
    ], NOW);

    expect(stats).toMatchObject({ visitors: 2, listens: 1, shares: 1, hasData: true });
    expect(stats.daily.at(-1)?.visitors).toBe(2);
  });

  it('separa los 30 dias anteriores y descarta lo mas viejo', () => {
    const stats = summarizeArtistStats([
      row({ created_at: '2026-10-15T12:00:00Z' }),
      row({ created_at: '2026-10-14T12:00:00Z' }),
      row({ created_at: '2026-09-15T12:00:00Z', event_type: 'status_click' }),
      row({ created_at: '2026-09-14T12:00:00Z' }),
      row({ created_at: 'fecha-mala' })
    ], NOW);

    expect(stats.visitors).toBe(1);
    expect(stats.previous).toEqual({ visitors: 1, listens: 1, shares: 0 });
  });

  it('agrupa el dia en hora de Bogota, no en UTC', () => {
    // 02:00 UTC del 13 = 9 p. m. del 12 en Bogota.
    const stats = summarizeArtistStats([row({ created_at: '2026-11-13T02:00:00Z' })], NOW);

    expect(stats.daily.at(-1)?.visitors).toBe(0);
    expect(stats.daily.at(-2)).toEqual({ date: '2026-11-12', visitors: 1 });
  });

  it('ordena las fuentes de mayor a menor y solo cuenta visitas', () => {
    const stats = summarizeArtistStats([
      row({ referrer: 'https://l.instagram.com/' }),
      row({ referrer: 'https://l.instagram.com/' }),
      row(),
      row({ referrer: 'https://l.instagram.com/', event_type: 'status_click' })
    ], NOW);

    expect(stats.sources).toEqual([
      { key: 'instagram', label: 'Instagram', visitors: 2 },
      { key: 'direct', label: 'Enlace directo', visitors: 1 }
    ]);
  });

  it('con mas de cinco fuentes, el resto se suma a "Otros sitios" y el total cuadra', () => {
    const refs = [
      'https://l.instagram.com/', 'https://www.facebook.com/', 'https://www.tiktok.com/',
      'https://www.youtube.com/', 'https://wa.me/', 'https://www.google.com/', 'https://blog.ejemplo.co/'
    ];
    const rows = refs.flatMap((referrer, index) => Array.from({ length: refs.length - index + 1 }, () => row({ referrer })));
    const stats = summarizeArtistStats(rows, NOW);

    expect(stats.sources).toHaveLength(6);
    expect(stats.sources.at(-1)).toMatchObject({ key: 'other', label: 'Otros sitios' });
    expect(stats.sources.reduce((sum, source) => sum + source.visitors, 0)).toBe(stats.visitors);
  });
});
