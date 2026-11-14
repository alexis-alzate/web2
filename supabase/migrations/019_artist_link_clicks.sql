-- 019: clics en los enlaces del artista (Spotify, Instagram, TikTok...).
--
-- Hasta ahora esos clics solo iban a Google Analytics y los pixeles, asi que
-- el portal del artista no podia mostrarlos. Esta tabla los guarda para la
-- tarjeta de estadisticas de /mi-perfil.
--
-- La pagina publica registra como maximo UN clic por navegador, por enlace y
-- por dia: son "personas que tocaron", no clics totales.
--
-- Se escribe solo desde admin/app/api/analytics/link-click/route.ts con
-- service_role. RLS activo y sin politicas: anon y authenticated no pueden
-- leer ni escribir.
--
-- La llave foranea a artists(slug) hace tres cosas: rechaza clics de un
-- artista que no existe, sigue al artista si se le cambia el slug y borra
-- sus clics si se borra el artista (igual que links y lanzamientos).

create table if not exists artist_link_clicks (
  id           uuid primary key default gen_random_uuid(),
  artist_slug  text not null
               references artists (slug) on update cascade on delete cascade,
  link_key     text not null
               check (link_key in ('tiktok', 'spotify', 'instagram', 'youtube', 'facebook', 'whatsapp')),
  -- hero = botones grandes de arriba; grid = la cuadricula de redes.
  placement    text not null check (placement in ('hero', 'grid')),
  device_type  text check (device_type in ('mobile', 'tablet', 'desktop')),
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists artist_link_clicks_artist_created_idx
  on artist_link_clicks (artist_slug, created_at desc);

alter table artist_link_clicks enable row level security;

revoke all on table artist_link_clicks from anon, authenticated;
grant select, insert, delete on table artist_link_clicks to service_role;
