-- Seguimiento global y privado de sesiones del portal Lujo Urban.
-- Aplica a administradores, artistas actuales y cualquier usuario futuro.
-- Solo el backend con service_role puede leer o escribir estas tablas.

create table if not exists portal_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'artist')),
  artist_slug text,
  login_method text not null,
  device_type text not null default 'unknown'
    check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason is null or end_reason in ('logout', 'expired')),
  created_at timestamptz not null default now(),
  check (last_seen_at >= started_at),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists portal_sessions_user_started_idx
  on portal_sessions (user_id, started_at desc);

create index if not exists portal_sessions_last_seen_idx
  on portal_sessions (last_seen_at desc);

create table if not exists portal_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references portal_sessions(id) on delete set null,
  event_type text not null,
  event_label text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portal_activity_events_user_created_idx
  on portal_activity_events (user_id, created_at desc);

create index if not exists portal_activity_events_session_idx
  on portal_activity_events (session_id, created_at desc);

alter table portal_sessions enable row level security;
alter table portal_activity_events enable row level security;

drop policy if exists "portal_sessions_solo_backend" on portal_sessions;
create policy "portal_sessions_solo_backend"
  on portal_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "portal_activity_events_solo_backend" on portal_activity_events;
create policy "portal_activity_events_solo_backend"
  on portal_activity_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table portal_sessions from public, anon, authenticated;
revoke all on table portal_activity_events from public, anon, authenticated;
grant select, insert, update, delete on table portal_sessions to service_role;
grant select, insert, update, delete on table portal_activity_events to service_role;

create or replace view portal_user_activity_summary
with (security_invoker = true)
as
with totals as (
  select
    user_id,
    count(*)::bigint as login_count,
    max(started_at) as last_login_at,
    round(sum(greatest(
      0,
      extract(epoch from (coalesce(ended_at, last_seen_at) - started_at))
    )))::bigint as total_active_seconds
  from portal_sessions
  group by user_id
), latest as (
  select distinct on (user_id)
    user_id,
    id as last_session_id,
    started_at as last_session_started_at,
    last_seen_at,
    ended_at,
    login_method as last_login_method,
    device_type as last_device_type,
    round(greatest(
      0,
      extract(epoch from (coalesce(ended_at, last_seen_at) - started_at))
    ))::bigint as last_session_seconds
  from portal_sessions
  order by user_id, started_at desc
)
select
  totals.user_id,
  totals.login_count,
  totals.last_login_at,
  totals.total_active_seconds,
  latest.last_session_id,
  latest.last_session_started_at,
  latest.last_seen_at,
  latest.ended_at,
  latest.last_login_method,
  latest.last_device_type,
  latest.last_session_seconds
from totals
join latest using (user_id);

revoke all on table portal_user_activity_summary from public, anon, authenticated;
grant select on table portal_user_activity_summary to service_role;

notify pgrst, 'reload schema';
