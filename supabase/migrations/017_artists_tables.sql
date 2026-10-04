-- Artistas como datos reales en Supabase (fase 1).
--
-- Hasta ahora los artistas vivian en artist-data.json y
-- artist-release-history.json dentro del repo, y los accesos se vinculaban
-- por slug en app_metadata. Eso permitia accesos "fantasma" (borrar o
-- renombrar un artista no quitaba el acceso) y que dos guardados
-- simultaneos se pisaran.
--
-- Esta migracion SOLO crea las tablas y copia los datos actuales. El codigo
-- del panel todavia no las usa: se conecta en un cambio posterior. Mientras
-- tanto los JSON siguen siendo la fuente de verdad, asi que antes de
-- cambiar el codigo hay que volver a sincronizar los datos.
--
-- Seguridad: RLS activo y sin politicas + revoke a anon/authenticated.
-- Solo service_role (el panel admin) puede leer o escribir.

create table artists (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null check (length(trim(name)) > 0),
  card_name       text not null,
  role            text not null default 'Artista oficial',
  tagline         text not null,
  bio             text not null,
  photo_path      text check (photo_path ~ '^assets/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$'),
  social_order    text[] not null
                  default array['tiktok','spotify','instagram','youtube','facebook','whatsapp']
                  check (social_order <@ array['tiktok','spotify','instagram','youtube','facebook','whatsapp']),
  hero_primary    text check (hero_primary   in ('tiktok','spotify','instagram','youtube','facebook','whatsapp')),
  hero_secondary  text check (hero_secondary in ('tiktok','spotify','instagram','youtube','facebook','whatsapp')),
  beats_embed_url       text check (beats_embed_url       ~ '^https://'),
  productions_embed_url text check (productions_embed_url ~ '^https://'),
  contact_label   text,
  contact_url     text check (contact_url ~ '^https?://'),
  position        int not null default 0,
  current_release_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (hero_primary is null or hero_secondary is null or hero_primary <> hero_secondary)
);

create table artist_links (
  artist_id  uuid not null references artists(id) on delete cascade,
  network    text not null check (network in ('tiktok','spotify','instagram','youtube','facebook','whatsapp')),
  url        text not null check (url ~ '^https?://'),
  primary key (artist_id, network)
);

create table artist_releases (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references artists(id) on delete cascade,
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text not null,
  link        text not null check (link ~ '^https?://'),
  cover_path  text,
  share_url   text check (share_url ~ '^https://'),
  status_url  text check (status_url ~ '^https://'),
  created_at  timestamptz not null default now(),
  unique (artist_id, slug),
  unique (id, artist_id)
);

-- El lanzamiento actual tiene que ser DEL MISMO artista. Si se borra ese
-- lanzamiento, solo se limpia current_release_id (no el id del artista).
alter table artists
  add constraint artists_current_release_fk
  foreign key (current_release_id, id)
  references artist_releases (id, artist_id)
  on delete set null (current_release_id);

create table artist_access (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  artist_id  uuid not null unique references artists(id) on delete cascade,
  status     text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create index artist_releases_artist_id_idx on artist_releases (artist_id);
create index artists_position_idx on artists (position);

create function set_updated_at() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger artists_set_updated_at
  before update on artists
  for each row execute function set_updated_at();

revoke execute on function set_updated_at() from public, anon, authenticated;

alter table artists        enable row level security;
alter table artist_links    enable row level security;
alter table artist_releases enable row level security;
alter table artist_access   enable row level security;

revoke all on artists, artist_links, artist_releases, artist_access from anon, authenticated;
grant select, insert, update, delete on artists, artist_links, artist_releases, artist_access to service_role;

-- Datos actuales (generados desde artist-data.json y artist-release-history.json).
insert into artists (slug, name, card_name, role, tagline, bio, photo_path, social_order, hero_primary, hero_secondary, beats_embed_url, productions_embed_url, contact_label, contact_url, position) values ('evangelista-gonzalez', 'EL EVANGELISTA GONZALEZ', 'Evangelista Gonzalez', 'Artista oficial', 'Mensaje, fe y propósito.', 'Perfil oficial de EL EVANGELISTA GONZALEZ dentro del ecosistema Lujo Urban.', 'assets/evangelista-gonzalez-photo.jpg', array['tiktok', 'spotify', 'instagram', 'youtube', 'facebook', 'whatsapp'], null, null, null, null, null, null, 0);
insert into artist_releases (artist_id, slug, title, link, cover_path, share_url, status_url) select id, 'instrumento-del-senor', 'Instrumento Del Señor', 'https://too.fm/11yo0l', 'assets/evangelista-gonzalez-instrumento-del-senor-cover.jpg', 'https://www.lujourban.com/lanzamientos/evangelista-gonzalez-instrumento-del-senor-v1/', 'https://www.lujourban.com/estados/evangelista-gonzalez-instrumento-del-senor-v1/' from artists where slug = 'evangelista-gonzalez';
update artists a set current_release_id = r.id from artist_releases r where r.artist_id = a.id and a.slug = 'evangelista-gonzalez' and r.slug = 'instrumento-del-senor';
insert into artists (slug, name, card_name, role, tagline, bio, photo_path, social_order, hero_primary, hero_secondary, beats_embed_url, productions_embed_url, contact_label, contact_url, position) values ('siervo-john', 'EL SIERVO JHON', 'El Siervo Jhon', 'Artista oficial', 'Identidad cristiana con visión urbana.', 'Perfil oficial de EL SIERVO JHON dentro del ecosistema Lujo Urban.', 'assets/siervo-john-photo.jpeg', array['tiktok', 'spotify', 'instagram', 'youtube', 'facebook', 'whatsapp'], null, null, null, null, null, null, 1);
insert into artist_links (artist_id, network, url) select id, 'tiktok', 'https://www.tiktok.com/@elsiervojhon?_r=1&_t=ZS-96uFZCQaekG' from artists where slug = 'siervo-john';
insert into artist_links (artist_id, network, url) select id, 'instagram', 'https://www.instagram.com/elsiervo_jhon?igsh=MTQ0NWt0dW1sOWZodg==' from artists where slug = 'siervo-john';
insert into artist_releases (artist_id, slug, title, link, cover_path, share_url, status_url) select id, 'murio-por-mi', 'Murió Por Mi', 'https://too.fm/p7k2g4d', 'assets/siervo-john-murio-por-mi-cover.jpg', 'https://www.lujourban.com/lanzamientos/siervo-john-murio-por-mi-v1/', 'https://www.lujourban.com/estados/siervo-john-murio-por-mi-v1/' from artists where slug = 'siervo-john';
update artists a set current_release_id = r.id from artist_releases r where r.artist_id = a.id and a.slug = 'siervo-john' and r.slug = 'murio-por-mi';
insert into artists (slug, name, card_name, role, tagline, bio, photo_path, social_order, hero_primary, hero_secondary, beats_embed_url, productions_embed_url, contact_label, contact_url, position) values ('la-libreta', 'JULIAN RAMOS', 'JULIAN RAMOS', 'Artista oficial', 'Música con identidad, visión y propósito.', 'Perfil oficial de JULIAN RAMOS dentro del ecosistema Lujo Urban.', 'assets/la-libreta-photo.jpg', array['instagram', 'tiktok', 'facebook', 'spotify', 'youtube', 'whatsapp'], 'spotify', 'youtube', null, null, null, null, 2);
insert into artist_links (artist_id, network, url) select id, 'tiktok', 'https://www.tiktok.com/@julian_ramos_lalibreta?_r=1&_t=ZS-98h4rMf3lkz' from artists where slug = 'la-libreta';
insert into artist_links (artist_id, network, url) select id, 'spotify', 'https://open.spotify.com/artist/3sNpPpejUtc0AVplD9Qvtf?si=TrMIaXWhQiSVWCBzCDNO8w&utm_source=copy-link' from artists where slug = 'la-libreta';
insert into artist_links (artist_id, network, url) select id, 'instagram', 'https://www.instagram.com/julian_ramos_lalibreta?igsh=MTl4dmFpd29kMzFkOA%3D%3D&utm_source=qr' from artists where slug = 'la-libreta';
insert into artist_links (artist_id, network, url) select id, 'youtube', 'https://youtube.com/@julianramoslalibreta?si=4_HSF7cXMIX5MYcd' from artists where slug = 'la-libreta';
insert into artist_links (artist_id, network, url) select id, 'facebook', 'https://www.facebook.com/share/1EhzcfUQVw/?mibextid=wwXIfr' from artists where slug = 'la-libreta';
insert into artist_releases (artist_id, slug, title, link, cover_path, share_url, status_url) select id, 'cantarle-a-el', 'CANTARLE A ÉL', 'https://hypeddit.com/cfv42c', 'assets/la-libreta-cantarle-a-el-cover.jpg', 'https://www.lujourban.com/lanzamientos/la-libreta-cantarle-a-el-v1/', 'https://www.lujourban.com/estados/la-libreta-cantarle-a-el-v1/' from artists where slug = 'la-libreta';
update artists a set current_release_id = r.id from artist_releases r where r.artist_id = a.id and a.slug = 'la-libreta' and r.slug = 'cantarle-a-el';

-- Accesos actuales: los usuarios artista vinculados por slug en app_metadata.
-- Los desvinculados ("inactive") y la cuenta de prueba no tienen fila.
insert into artist_access (user_id, artist_id, status)
select u.id, a.id, u.raw_app_meta_data->>'lujo_access'
from auth.users u
join artists a on a.slug = u.raw_app_meta_data->>'lujo_artist_slug'
where u.raw_app_meta_data->>'lujo_role' = 'artist'
  and u.raw_app_meta_data->>'lujo_access' in ('active', 'suspended');

notify pgrst, 'reload schema';
