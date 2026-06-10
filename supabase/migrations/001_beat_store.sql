-- Tienda de beats: tablas base
-- Ejecutar en Supabase > SQL Editor

create table beats (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  bpm int,
  key text,
  genre text,
  tags text[],
  cover_url text,
  preview_url text,
  price_basic int not null,
  price_premium int not null,
  price_exclusive int not null,
  file_basic_path text,
  file_premium_path text,
  file_exclusive_path text,
  status text not null default 'available' check (status in ('available', 'sold_exclusive')),
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references beats(id),
  license_type text not null check (license_type in ('basic', 'premium', 'exclusive')),
  buyer_email text not null,
  amount int not null,
  mp_preference_id text,
  mp_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table downloads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  download_count int not null default 0,
  max_downloads int not null default 3,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS: el catálogo de beats es público para lectura, el resto solo accesible
-- desde Edge Functions (service role), no desde el frontend directo.
alter table beats enable row level security;
alter table orders enable row level security;
alter table downloads enable row level security;

create policy "beats publicos para lectura"
  on beats for select
  using (true);

-- Indice para que el webhook pueda chequear rapido si un pago
-- ya fue procesado (evita duplicados en reintentos de MercadoPago)
create unique index orders_mp_payment_id_idx
  on orders (mp_payment_id)
  where mp_payment_id is not null;
