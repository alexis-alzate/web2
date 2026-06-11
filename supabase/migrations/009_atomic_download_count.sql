-- Contador de descargas atomico: el incremento y el chequeo del limite
-- ocurren en una sola operacion, sin carrera entre descargas simultaneas.
-- Ejecutar en Supabase > SQL Editor

create or replace function consume_download(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  update downloads
  set download_count = download_count + 1,
      used_at = now()
  where id = p_id
    and download_count < max_downloads;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

-- Solo el backend (service role) puede consumir descargas
revoke execute on function consume_download(uuid) from public;
grant execute on function consume_download(uuid) to service_role;
