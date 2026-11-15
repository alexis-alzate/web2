-- Liquidaciones: como se le paga a cada productor y el registro de cada pago.
--
-- 1) `producers` guarda DONDE recibe su plata (Nequi, Daviplata, Bancolombia u
--    otro) y el titular. Las llena el propio productor desde su portal.
-- 2) `producer_payouts` es el libro de pagos: cada fila es UNA transferencia
--    real que hizo Lujo Urban, con su referencia (numero de comprobante) y una
--    copia de la cuenta a la que se envio (si el productor cambia de cuenta,
--    el pago viejo conserva a donde fue).
-- 3) `producer_earnings.payout_id` enlaza cada venta con el pago que la cubrio.
--    Las ventas marcadas como pagadas antes de esta migracion quedan sin pago
--    enlazado (payout_id null): son historia, no se tocan.
-- 4) `producer_earnings.available_at` es el dia en que la venta se libera para
--    pagarse. Cada venta nueva se libera 7 dias despues de comprarse (valor por
--    defecto de la columna: la funcion que aprueba las ordenes NO cambia), para
--    cubrir devoluciones. Las ventas pendientes que ya existian se liberan 7 dias
--    despues de su propia fecha.
-- 5) `register_producer_payout` paga TODO lo LIBERADO de un productor en una
--    sola transaccion: suma, marca las ventas, crea el pago. Dos clics
--    seguidos no pueden pagar dos veces lo mismo. Si lo liberado no llega al
--    minimo que se le pasa, no paga nada.
--
-- ATENCION: la cuenta de cobro es un dato sensible. Las tablas quedan con RLS y
-- sin politicas: solo el cliente de servicio (panel y portal, siempre desde el
-- servidor) puede leerlas. La tienda publica NO las selecciona.

alter table producers
  add column if not exists payout_method text,
  add column if not exists payout_account text,
  add column if not exists payout_holder text;

alter table producers drop constraint if exists producers_payout_method_valid;
alter table producers
  add constraint producers_payout_method_valid
  check (payout_method is null or payout_method in ('nequi', 'daviplata', 'bancolombia', 'otro'));

-- Metodo y cuenta van juntos: o estan los dos o no esta ninguno.
alter table producers drop constraint if exists producers_payout_complete;
alter table producers
  add constraint producers_payout_complete
  check ((payout_method is null) = (payout_account is null));

alter table producers drop constraint if exists producers_payout_account_length;
alter table producers
  add constraint producers_payout_account_length
  check (payout_account is null or char_length(payout_account) between 3 and 80);

alter table producers drop constraint if exists producers_payout_holder_length;
alter table producers
  add constraint producers_payout_holder_length
  check (payout_holder is null or char_length(payout_holder) between 3 and 80);

create table if not exists producer_payouts (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references producers(id) on delete restrict,
  amount int not null check (amount > 0),
  earnings_count int not null check (earnings_count > 0),
  method text not null check (method in ('nequi', 'daviplata', 'bancolombia', 'otro')),
  account text not null check (char_length(account) between 3 and 80),
  holder text check (holder is null or char_length(holder) between 3 and 80),
  reference text not null check (char_length(reference) between 1 and 120),
  paid_by text not null check (char_length(paid_by) between 1 and 200),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists producer_payouts_producer_idx on producer_payouts (producer_id, paid_at desc);
create index if not exists producer_payouts_paid_at_idx on producer_payouts (paid_at desc);

alter table producer_payouts enable row level security;

-- El enlace es "deferrable": la funcion de abajo marca las ventas ANTES de
-- insertar el pago (necesita sumarlas primero), y la base revisa el enlace al
-- final de la transaccion.
alter table producer_earnings
  add column if not exists payout_id uuid
  references producer_payouts(id) on delete restrict deferrable initially deferred;

create index if not exists producer_earnings_payout_idx on producer_earnings (payout_id);

-- Dia en que cada venta se libera para pagarse. Se agrega sin valor, se rellena
-- con la fecha de cada venta y SOLO DESPUES se fija el valor por defecto: asi las
-- ventas viejas no quedan con "hoy + 7 dias".
-- Si cambias los 7 dias, cambia tambien HOLD_DAYS en admin/lib/producers/payout-rules.ts.
alter table producer_earnings add column if not exists available_at timestamptz;

update producer_earnings
set available_at = created_at + interval '7 days'
where available_at is null;

alter table producer_earnings alter column available_at set default (now() + interval '7 days');
alter table producer_earnings alter column available_at set not null;

create index if not exists producer_earnings_release_idx
  on producer_earnings (producer_id, status, available_at);

-- Paga todo lo LIBERADO (pendiente y con available_at ya cumplido) de un productor.
--   p_expected_account: la cuenta que el admin tenia en pantalla al confirmar.
--   Si el productor la cambio mientras tanto, NO se paga y se pide revisar.
--   p_min_amount: pago minimo. Si lo liberado es menos, no se paga nada.
-- Los mensajes que empiezan con "LU:" son para mostrarse tal cual al admin.
drop function if exists register_producer_payout(uuid, text, text, text);

create or replace function register_producer_payout(
  p_producer_id uuid,
  p_reference text,
  p_paid_by text,
  p_expected_account text,
  p_min_amount int default 0
)
returns table (out_payout_id uuid, out_amount int, out_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producer producers%rowtype;
  v_payout_id uuid := gen_random_uuid();
  v_amount int;
  v_count int;
begin
  if p_reference is null or char_length(btrim(p_reference)) = 0 then
    raise exception 'LU: Escribe la referencia del pago (por ejemplo el numero del comprobante).';
  end if;

  -- Bloquea al productor: dos pagos simultaneos se hacen en fila, no a la vez.
  select * into v_producer from producers where id = p_producer_id for update;
  if not found then
    raise exception 'LU: No encontre a ese productor.';
  end if;

  if v_producer.payout_method is null or v_producer.payout_account is null then
    raise exception 'LU: Este productor todavia no dijo como quiere recibir su pago.';
  end if;

  if v_producer.payout_account is distinct from p_expected_account then
    raise exception 'LU: Los datos de pago del productor cambiaron. Recarga el panel, revisa la cuenta y confirma otra vez.';
  end if;

  -- Una sola sentencia marca las ventas y devuelve lo marcado: el monto del
  -- pago es EXACTAMENTE la suma de lo que quedo pagado, aunque entre una venta
  -- nueva mientras tanto (esa queda pendiente para el proximo pago).
  with paid as (
    update producer_earnings
    set status = 'paid', paid_at = now(), payout_id = v_payout_id
    where producer_id = p_producer_id
      and status = 'pending'
      and available_at <= now()
    returning producer_amount
  )
  select coalesce(sum(producer_amount), 0)::int, count(*)::int
  into v_amount, v_count
  from paid;

  if v_count = 0 or v_amount <= 0 then
    raise exception 'LU: Este productor no tiene ventas liberadas para pagar todavia.';
  end if;

  -- Al fallar aqui, el UPDATE de arriba se deshace: no queda nada pagado.
  if v_amount < coalesce(p_min_amount, 0) then
    raise exception 'LU: Lo liberado (% COP) no llega al pago minimo de % COP.', v_amount, p_min_amount;
  end if;

  insert into producer_payouts (
    id, producer_id, amount, earnings_count, method, account, holder, reference, paid_by
  ) values (
    v_payout_id, p_producer_id, v_amount, v_count,
    v_producer.payout_method, v_producer.payout_account, v_producer.payout_holder,
    btrim(p_reference), p_paid_by
  );

  return query select v_payout_id, v_amount, v_count;
end;
$$;

-- Solo el servidor (service_role) puede pagar. Nadie con la llave publica.
revoke execute on function register_producer_payout(uuid, text, text, text, int) from public, anon, authenticated;
grant execute on function register_producer_payout(uuid, text, text, text, int) to service_role;

notify pgrst, 'reload schema';
