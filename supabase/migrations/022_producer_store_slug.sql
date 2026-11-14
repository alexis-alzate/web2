-- Cada productor tiene su propia tienda publica en
-- tienda.lujourban.com/productor/<slug>, exista o no con beats.
--
-- Migracion no destructiva: agrega la columna `slug` a `producers`, se la pone
-- a los productores que ya existen y deja un trigger que se la pone sola a los
-- nuevos (los dos caminos de creacion: el formulario del panel y la aprobacion
-- de solicitudes). El slug sale del nombre artistico y, si ya existe, lleva un
-- numero: helmentt, helmentt-2...

alter table producers add column if not exists slug text;

create or replace function producer_slug_base(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        translate(lower(coalesce(p_name, '')), 'áéíóúüñàèìòùâêîôû', 'aeiouunaeiouaeiou'),
        '[^a-z0-9]+', '-', 'g'
      )),
      ''
    ),
    'productor'
  );
$$;

create or replace function producers_set_slug()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  base := producer_slug_base(new.stage_name);
  candidate := base;
  while exists (select 1 from producers where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

-- Los productores que ya existian.
do $$
declare
  r record;
  base text;
  candidate text;
  n int;
begin
  for r in select id, stage_name from producers where slug is null order by created_at loop
    base := producer_slug_base(r.stage_name);
    candidate := base;
    n := 1;
    while exists (select 1 from producers where slug = candidate) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update producers set slug = candidate where id = r.id;
  end loop;
end;
$$;

alter table producers alter column slug set not null;
alter table producers
  add constraint producers_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create unique index if not exists producers_slug_key on producers (slug);

drop trigger if exists producers_set_slug_trg on producers;
create trigger producers_set_slug_trg
  before insert on producers
  for each row execute function producers_set_slug();

-- Permisos de funciones (ver AGENTS.md, seccion 10): nada de EXECUTE para
-- anon ni authenticated; solo service_role.
revoke execute on function producer_slug_base(text) from public, anon, authenticated;
revoke execute on function producers_set_slug() from public, anon, authenticated;
grant execute on function producer_slug_base(text) to service_role;
grant execute on function producers_set_slug() to service_role;
