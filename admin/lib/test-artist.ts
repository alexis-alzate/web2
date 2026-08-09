import type { Artist } from '@/lib/artist-renderer';

export const TEST_ARTIST_SLUG = '__lujo_prueba__';

const DEFAULT_TEST_ARTIST: Artist = {
  name: 'ARTISTA DE PRUEBA',
  cardName: 'Cuenta de prueba',
  slug: 'prueba-privada',
  role: 'Modo privado',
  tagline: 'Prueba el portal sin modificar un artista real.',
  bio: 'Perfil privado para verificar las funciones del portal de artistas de Lujo Urban.',
  links: {
    tiktok: 'https://www.tiktok.com/',
    spotify: 'https://open.spotify.com/',
    instagram: 'https://www.instagram.com/',
    youtube: 'https://www.youtube.com/'
  },
  socialOrder: ['tiktok', 'spotify', 'instagram', 'youtube', 'facebook', 'whatsapp'],
  heroButtons: {
    primary: 'spotify',
    secondary: 'tiktok'
  },
  release: {
    title: 'Lanzamiento de prueba',
    slug: 'lanzamiento-prueba',
    link: 'https://open.spotify.com/'
  },
  beatsEmbed: '',
  productionsEmbed: '',
  contact: null
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const readTestArtist = (value: unknown): Artist => {
  if (!isRecord(value)) return structuredClone(DEFAULT_TEST_ARTIST);

  const stored = value as Partial<Artist>;
  return {
    ...structuredClone(DEFAULT_TEST_ARTIST),
    ...stored,
    name: DEFAULT_TEST_ARTIST.name,
    cardName: DEFAULT_TEST_ARTIST.cardName,
    slug: DEFAULT_TEST_ARTIST.slug,
    role: DEFAULT_TEST_ARTIST.role,
    tagline: DEFAULT_TEST_ARTIST.tagline,
    links: isRecord(stored.links) ? stored.links as Record<string, string> : { ...DEFAULT_TEST_ARTIST.links },
    release: isRecord(stored.release)
      ? { ...DEFAULT_TEST_ARTIST.release!, ...stored.release } as NonNullable<Artist['release']>
      : { ...DEFAULT_TEST_ARTIST.release! }
  };
};

export const createTestArtist = () => readTestArtist(null);
