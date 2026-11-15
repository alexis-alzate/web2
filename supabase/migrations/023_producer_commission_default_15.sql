-- La comision de la plataforma por defecto pasa de 30 % a 15 %.
--
-- El codigo (formulario del panel y aprobacion de solicitudes) ya manda 15 %
-- de forma explicita, pero la columna conservaba el 30 % de la migracion 013:
-- un productor creado por cualquier otra via (por ejemplo, un INSERT a mano)
-- quedaba en 30 % sin avisar, y la pagina de la plataforma promete 85 % para
-- el productor.
--
-- No destructiva: solo cambia el valor por defecto de las filas NUEVAS. No
-- modifica la comision de ningun productor que ya existe.

alter table producers
  alter column platform_commission_percent set default 15.00;
