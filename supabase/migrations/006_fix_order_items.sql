create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  beat_id uuid not null references beats(id),
  license_type text not null check (license_type in ('basic', 'premium', 'exclusive')),
  amount int not null
);

alter table order_items enable row level security;

create unique index if not exists orders_mp_payment_id_idx
  on orders (mp_payment_id)
  where mp_payment_id is not null;
npm
notify pgrst, 'reload schema';
