-- Lista de espera de artistas que piden su pagina (formulario publico en
-- www.lujourban.com/unete/). Migracion no destructiva: solo agrega una tabla.
--
-- La escribe el endpoint POST /api/waitlist del panel (service_role) y la lee
-- el panel. RLS activo y sin politicas: ni anon ni authenticated pueden leer
-- ni escribir, igual que las tablas de artistas (migracion 017).

create table if not exists artist_waitlist (
  id uuid primary key default gen_random_uuid(),
  stage_name text not null check (char_length(stage_name) between 2 and 80),
  -- Solo digitos, con indicativo de pais (57 para Colombia). Es la llave para
  -- no guardar dos veces a la misma persona.
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  -- Usuario sin @ ni URL.
  instagram text not null check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  followers_range text not null
    check (followers_range in ('lt_1k', '1k_10k', '10k_50k', 'gt_50k')),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'approved', 'rejected')),
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (whatsapp)
);

create index if not exists artist_waitlist_created_at_idx
  on artist_waitlist (created_at desc);

alter table artist_waitlist enable row level security;
