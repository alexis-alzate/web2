// Paginas HTML que se generan para compartir un lanzamiento de artista en
// redes (vista previa con portada) y su pagina de estado. Es solo
// presentacion: no lee ni escribe en la base ni en GitHub.

import type { Artist } from '@/backend/integrations/artist-renderer';

const escapeHtml = (value: string) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

export const buildArtistReleaseSharePages = (params: {
  artist: Pick<Artist, 'name' | 'slug'>;
  releaseTitle: string;
  releaseSlug: string;
  version: string;
  cover: string;
}) => {
  const baseSlug = `${params.artist.slug}-${params.releaseSlug}`;
  const shareDirectory = `lanzamientos/${baseSlug}-v${params.version}`;
  const statusDirectory = `estados/${baseSlug}-v${params.version}`;
  const shareUrl = `https://www.lujourban.com/${shareDirectory}/`;
  const statusUrl = `https://www.lujourban.com/${statusDirectory}/`;
  const shareImageUrl = `https://www.lujourban.com/${params.cover}?v=${params.version}`;
  const socialTitle = `${params.releaseTitle} - ${params.artist.name}`;
  const socialDescription = `Escucha ${params.releaseTitle}, el nuevo lanzamiento de ${params.artist.name}.`;
  const artistProfileUrl = `/artistas/${params.artist.slug}/`;

  const sharePage = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="website">
<meta property="og:url" content="${shareUrl}">
<meta property="og:title" content="${escapeHtml(socialTitle)}">
<meta property="og:description" content="${escapeHtml(socialDescription)}">
<meta property="og:image" content="${shareImageUrl}">
<meta property="og:image:secure_url" content="${shareImageUrl}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="600">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(socialTitle)}">
<meta name="twitter:description" content="${escapeHtml(socialDescription)}">
<meta name="twitter:image" content="${shareImageUrl}">
<meta http-equiv="refresh" content="0;url=${artistProfileUrl}">
<title>${escapeHtml(socialTitle)}</title>
<script>window.location.replace('${artistProfileUrl}');</script>
</head>
<body>
<p><a href="${artistProfileUrl}">Ir al perfil oficial de ${escapeHtml(params.artist.name)}</a></p>
</body>
</html>
`;

  const statusPage = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="website">
<meta property="og:url" content="${statusUrl}">
<meta property="og:title" content="${escapeHtml(socialTitle)}">
<meta property="og:description" content="${escapeHtml(socialDescription)}">
<meta property="og:image" content="${shareImageUrl}">
<meta property="og:image:secure_url" content="${shareImageUrl}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="600">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(socialTitle)}">
<meta name="twitter:description" content="${escapeHtml(socialDescription)}">
<meta name="twitter:image" content="${shareImageUrl}">
<title>${escapeHtml(socialTitle)}</title>
</head>
<body style="margin:0;background:#020302;color:#fff;font-family:Arial,sans-serif;">
<main style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;">
<a href="${artistProfileUrl}" style="color:inherit;text-decoration:none;">
<img src="${shareImageUrl}" alt="${escapeHtml(socialTitle)}" style="display:block;width:min(100%,1200px);height:auto;border:0;">
<p>Ir al perfil oficial de ${escapeHtml(params.artist.name)}</p>
</a>
</main>
</body>
</html>
`;

  return {
    shareUrl,
    statusUrl,
    files: [
      { path: `${shareDirectory}/index.html`, content: sharePage },
      { path: `${statusDirectory}/index.html`, content: statusPage }
    ]
  };
};
