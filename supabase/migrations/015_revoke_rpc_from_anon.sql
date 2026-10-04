-- Cierra la ejecucion de las RPC de compra desde la llave publica.
--
-- Supabase le concede EXECUTE a anon y authenticated de forma EXPLICITA
-- (default privileges del esquema public). Por eso el
-- `revoke ... from public` de las migraciones 009/010/011/013 no les quitaba
-- nada: cualquiera con la publishable key podia llamar
-- POST /rest/v1/rpc/approve_order_safely y aprobar una orden sin pagar.
--
-- Ya aplicada en produccion (lujourban-admin) el 2026-10-04.

revoke execute on function public.approve_order_safely(uuid, text) from anon, authenticated;
revoke execute on function public.consume_download(uuid) from anon, authenticated;
grant execute on function public.approve_order_safely(uuid, text) to service_role;
grant execute on function public.consume_download(uuid) to service_role;

-- Funciones futuras del esquema public nacen sin EXECUTE para anon/authenticated.
-- Si alguna vez una RPC SI debe ser publica, darle el grant explicito.
alter default privileges in schema public revoke execute on functions from anon, authenticated;

notify pgrst, 'reload schema';
