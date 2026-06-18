-- Marketplace interno de productores para la tienda de beats.
-- Migracion no destructiva: agrega productores, asociacion opcional a beats
-- y registro de ganancias por item vendido.

create table if not exists producers (
  id uuid primary key default gen_random_uuid(),
  stage_name text not null,
  email text not null,
  platform_commission_percent numeric(5,2) not null default 30.00
    check (platform_commission_percent >= 0 and platform_commission_percent <= 100),
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now()
);

alter table beats
  add column if not exists producer_id uuid references producers(id) on delete set null;

create table if not exists producer_earnings (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references producers(id) on delete restrict,
  order_id uuid not null references orders(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  beat_id uuid not null references beats(id) on delete restrict,
  license_type text not null check (license_type in ('basic', 'premium', 'exclusive')),
  gross_amount int not null check (gross_amount >= 0),
  platform_commission_percent numeric(5,2) not null check (platform_commission_percent >= 0 and platform_commission_percent <= 100),
  platform_fee_amount int not null check (platform_fee_amount >= 0),
  producer_amount int not null check (producer_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  producer_notified_at timestamptz,
  producer_notification_error text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_item_id)
);

create index if not exists beats_producer_id_idx on beats (producer_id);
create index if not exists producer_earnings_producer_id_idx on producer_earnings (producer_id);
create index if not exists producer_earnings_order_id_idx on producer_earnings (order_id);
create index if not exists producer_earnings_created_at_idx on producer_earnings (created_at desc);

alter table producers enable row level security;
alter table producer_earnings enable row level security;

create or replace function approve_order_safely(p_order_id uuid, p_payment_id text)
returns table (should_send_email boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_order orders%rowtype;
  item_count int;
begin
  select *
  into locked_order
  from orders
  where id = p_order_id
  for update;

  if not found then
    return;
  end if;

  select count(*)
  into item_count
  from order_items
  where order_id = p_order_id;

  if item_count = 0 then
    raise exception 'La orden % no tiene items.', p_order_id;
  end if;

  insert into downloads (order_item_id)
  select oi.id
  from order_items oi
  where oi.order_id = p_order_id
    and not exists (
      select 1
      from downloads d
      where d.order_item_id = oi.id
    );

  update beats b
  set status = 'sold_exclusive'
  from order_items oi
  where oi.order_id = p_order_id
    and oi.license_type = 'exclusive'
    and oi.beat_id = b.id;

  insert into producer_earnings (
    producer_id,
    order_id,
    order_item_id,
    beat_id,
    license_type,
    gross_amount,
    platform_commission_percent,
    platform_fee_amount,
    producer_amount
  )
  select
    p.id,
    oi.order_id,
    oi.id,
    oi.beat_id,
    oi.license_type,
    oi.amount,
    p.platform_commission_percent,
    round(oi.amount::numeric * p.platform_commission_percent / 100)::int as platform_fee_amount,
    oi.amount - round(oi.amount::numeric * p.platform_commission_percent / 100)::int as producer_amount
  from order_items oi
  join beats b on b.id = oi.beat_id
  join producers p on p.id = b.producer_id
  where oi.order_id = p_order_id
    and p.status = 'active'
  on conflict (order_item_id) do nothing;

  update orders
  set status = 'approved',
      mp_payment_id = p_payment_id
  where id = p_order_id;

  return query select locked_order.download_email_sent_at is null;
end;
$$;

revoke execute on function approve_order_safely(uuid, text) from public;
grant execute on function approve_order_safely(uuid, text) to service_role;

notify pgrst, 'reload schema';
