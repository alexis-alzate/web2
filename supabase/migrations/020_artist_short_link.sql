-- 020: enlace corto del artista (www.lujourban.com/<enlace>).
--
-- Un nombre corto y unico que redirige a la pagina del artista
-- (/artistas/<slug>/), pensado para la bio de Instagram o TikTok. Es opcional:
-- null = el artista no tiene enlace corto.
--
-- El panel genera las redirecciones en vercel.json a partir de esta columna
-- (admin/lib/artists/short-link.ts). Las reglas finas (nombres reservados,
-- que no choque con el slug de otro artista) las valida el servicio; la base
-- solo garantiza el formato y que no se repita.

alter table artists
  add column if not exists short_link text
  check (
    short_link is null
    or (short_link ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(short_link) between 3 and 30)
  );

create unique index if not exists artists_short_link_key
  on artists (short_link)
  where short_link is not null;
