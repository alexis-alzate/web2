-- Soporte de carrito multi-item: una orden ahora puede contener varios beats/licencias
-- Ejecutar en Supabase > SQL Editor
-- (no hay ordenes reales todavia, asi que recreamos orders/downloads desde cero)

drop table if exists downloads;
drop table if exists orders;

create table orders (
  id uuid primary key default gen_random_uuid(),
  buyer_email text not null,
  total_amount int not null,
  mp_preference_id text,
  mp_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  beat_id uuid not null references beats(id),
  license_type text not null check (license_type in ('basic', 'premium', 'exclusive')),
  amount int not null
);

create table downloads (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  download_count int not null default 0,
  max_downloads int not null default 3,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table orders enable row level security;
alter table order_items enable row level security;
alter table downloads enable row level security;

-- Indice para que el webhook pueda chequear rapido si un pago
-- ya fue procesado (evita duplicados en reintentos de MercadoPago)
create unique index orders_mp_payment_id_idx
  on orders (mp_payment_id)
  where mp_payment_id is not null;
