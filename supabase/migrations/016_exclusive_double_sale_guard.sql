-- Evita vender dos veces un beat en exclusiva.
--
-- Problema: el checkout solo valida beats.status = 'available' al CREAR la
-- orden. Si dos compradores abren checkout de la misma exclusiva (o de una
-- basica/premium de un beat que luego se vende en exclusiva) y ambos pagan,
-- approve_order_safely aprobaba las dos y entregaba archivos a ambos.
--
-- Solucion:
-- 1. Nuevo estado de orden 'conflict': pago recibido pero el beat ya estaba
--    vendido en exclusiva. No se crean descargas ni ganancias de productor;
--    el admin debe reembolsar desde Mercado Pago.
-- 2. approve_order_safely bloquea (FOR UPDATE) los beats de la orden, en
--    orden de id para no generar deadlocks, antes de decidir. Dos aprobaciones
--    concurrentes de la misma exclusiva quedan serializadas: la primera vende,
--    la segunda ve 'sold_exclusive' y cae en conflict.
-- 3. La funcion devuelve una columna nueva `is_conflict` para que la tienda
--    avise al admin. `should_send_email` se mantiene igual (compatible con el
--    codigo anterior, que solo lee esa columna).
--
-- Una orden que YA estaba aprobada nunca pasa a conflict: el re-envio del
-- webhook sigue siendo idempotente aunque su propio beat este vendido.
--
-- Nota de negocio: una basica/premium aprobada ANTES de la exclusiva no es
-- conflicto (la licencia no exclusiva previa sigue vigente). Lo que se bloquea
-- es cualquier licencia aprobada DESPUES de que el beat quedo exclusivo,
-- incluido el caso de marcarlo vendido a mano por una venta externa.
--
-- Ya aplicada en produccion (lujourban-admin) el 2026-10-04 desde el SQL
-- Editor, y probada con una simulacion revertida: o1 exclusiva -> approved,
-- o2 exclusiva del mismo beat -> conflict, o3 basica posterior -> conflict,
-- reintento del webhook de o1 -> sigue approved.

alter table orders
  add column if not exists conflict_notified_at timestamptz;

alter table orders drop constraint if exists orders_status_check;
alter table orders
  add constraint orders_status_check
  check (status in ('pending', 'approved', 'rejected', 'conflict'));

-- Cambia el tipo de retorno, asi que hay que borrarla y recrearla.
drop function if exists approve_order_safely(uuid, text);

create function approve_order_safely(p_order_id uuid, p_payment_id text)
returns table (should_send_email boolean, is_conflict boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_order orders%rowtype;
  item_count int;
  sold_count int;
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

  -- Bloquear los beats de la orden en orden estable antes de leer su estado.
  perform 1
  from beats b
  where b.id in (select oi.beat_id from order_items oi where oi.order_id = p_order_id)
  order by b.id
  for update;

  if locked_order.status <> 'approved' then
    select count(*)
    into sold_count
    from order_items oi
    join beats b on b.id = oi.beat_id
    where oi.order_id = p_order_id
      and b.status = 'sold_exclusive';

    if sold_count > 0 then
      update orders
      set status = 'conflict',
          mp_payment_id = p_payment_id
      where id = p_order_id;

      return query select false, true;
      return;
    end if;
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

  return query select locked_order.download_email_sent_at is null, false;
end;
$$;

-- Ver migracion 015: hay que revocar EXPLICITAMENTE a anon/authenticated.
revoke execute on function approve_order_safely(uuid, text) from public, anon, authenticated;
grant execute on function approve_order_safely(uuid, text) to service_role;

notify pgrst, 'reload schema';
