-- La licencia interna "exclusive" queda como legado para la tercera licencia
-- comprable, mostrada al usuario como "Ilimitada". La exclusiva real pasa
-- por formulario de oferta y no por checkout directo.
-- Esta migracion es no destructiva.

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
