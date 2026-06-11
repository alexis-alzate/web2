-- Tabla de configuracion simple (clave/valor) para flags del sitio.
-- Ejecutar en Supabase > SQL Editor

create table app_settings (
  key text primary key,
  value boolean not null default false
);

insert into app_settings (key, value) values ('show_demo_beats', true);

alter table app_settings enable row level security;

create policy "app_settings publico para lectura"
  on app_settings for select
  using (true);
