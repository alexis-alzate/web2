-- Seguimiento de ofertas para licencias exclusivas negociadas.
-- La compra directa mantiene 3 licencias: basica, premium e ilimitada.
-- La exclusiva real se registra aqui desde el formulario "Make an offer".

create table if not exists beat_offers (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid references beats(id) on delete set null,
  beat_slug text not null,
  beat_title text not null,
  full_name text not null,
  email text not null,
  amount text not null,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'accepted', 'rejected', 'closed')),
  created_at timestamptz not null default now()
);

alter table beat_offers enable row level security;

create index if not exists beat_offers_created_at_idx
  on beat_offers (created_at desc);

create index if not exists beat_offers_beat_id_idx
  on beat_offers (beat_id);

notify pgrst, 'reload schema';
