-- A partir de esta migracion, no ejecutar 003_cart_support.sql ni
-- 007_fix_cart_schema.sql contra produccion con ventas reales: esas
-- migraciones historicas recrean tablas de compra y pueden borrar ordenes.
-- Esta migracion es no destructiva.

alter table orders
  add column if not exists download_email_sent_at timestamptz;

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
