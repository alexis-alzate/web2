import { artistService } from '@/lib/artists';
import { publicArtistUrl } from '@/lib/artists/short-link';
import { createArtistQr, parseQrFormat } from '@/lib/artist-qr';
import { requireActiveArtist } from '@/lib/auth';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { qrRenderer } from '@/lib/qr';
import { errorResponse } from '@/lib/route-error';
import { TEST_ARTIST_SLUG } from '@/lib/test-artist';

// QR de la pagina del artista que tiene la sesion abierta.
//   GET /api/portal/qr?formato=png|svg            -> se muestra en el navegador
//   GET /api/portal/qr?formato=png|svg&descargar=1 -> se descarga como archivo
//
// Controlador delgado: comprueba la sesion, lee la peticion y responde. Las
// reglas viven en lib/artist-qr.ts y el dibujo en lib/qr.
// El artista sale SIEMPRE de la sesion, nunca de la peticion: nadie puede
// pedir el QR de otro. El proxy no cubre /api/, por eso la sesion se comprueba
// aqui mismo.

export const runtime = 'nodejs';

export const GET = async (request: Request) => {
  try {
    const access = await requireActiveArtist();
    const slug = access.artistSlug;
    if (!slug) throw new ForbiddenError('Este acceso no esta vinculado a un artista.');
    if (slug === TEST_ARTIST_SLUG) {
      throw new ForbiddenError('La cuenta de prueba no tiene página pública.');
    }

    const record = await artistService.findArtistBySlug(slug);
    if (!record) throw new NotFoundError('No encontramos tu página.');

    const params = new URL(request.url).searchParams;
    const format = parseQrFormat(params.get('formato'));
    const qr = await createArtistQr(
      { slug: record.artist.slug, url: publicArtistUrl(record.artist), format },
      qrRenderer
    );

    const headers: Record<string, string> = {
      'Content-Type': qr.contentType,
      // Depende de la sesion y del enlace del artista, que puede cambiar.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      // El SVG se abre solo como imagen: sin scripts ni recursos externos.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    };
    if (params.get('descargar') === '1') {
      headers['Content-Disposition'] = `attachment; filename="${qr.fileName}"`;
    }

    return new Response(qr.body as BodyInit, { headers });
  } catch (error) {
    return errorResponse(error);
  }
};
