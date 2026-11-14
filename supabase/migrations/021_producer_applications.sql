-- Solicitudes de productores que quieren vender sus beats (formulario publico
-- en www.lujourban.com/vender/). Migracion no destructiva: solo agrega una tabla.
--
-- La escribe el endpoint POST /api/producer-applications del panel
-- (service_role) y la lee y revisa el panel. RLS activo y sin politicas: ni
-- anon ni authenticated pueden leer ni escribir, igual que artist_waitlist.
--
-- Aprobar una solicitud crea la fila en `producers` y envia la invitacion para
-- crear la clave; mientras tanto NO existe ninguna cuenta ni se envia ningun
-- correo a quien lleno el formulario.

create table if not exists producer_applications (
  id uuid primary key default gen_random_uuid(),
  stage_name text not null check (char_length(stage_name) between 2 and 80),
  -- Siempre en minusculas: es la llave para no guardar dos veces a la misma persona.
  email text not null
    check (email = lower(email) and char_length(email) between 5 and 254),
  -- Enlace https a su musica (Instagram, YouTube, BeatStars, Spotify...).
  music_url text not null check (char_length(music_url) between 8 and 300),
  status text not null default 'new'
    check (status in ('new', 'approved', 'rejected')),
  -- Se llena al aprobar: el productor que se creo a partir de esta solicitud.
  producer_id uuid references producers(id) on delete set null,
  source_url text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email)
);

create index if not exists producer_applications_created_at_idx
  on producer_applications (created_at desc);

alter table producer_applications enable row level security;
