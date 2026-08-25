-- ═══════════════════════════════════════════════════════════════════════════
--  K-05 / K-07 · El CHECK de `suscripciones.plan` prohíbe el único plan que existe
--
--  La tabla se creó cuando había tres planes (boutique/hotel/grande). Hoy el
--  código tiene UNO solo: 'kora' ($550/mes, lib/oferta.ts:28). El CHECK nunca se
--  actualizó, así que CUALQUIER alta de suscripción es rechazada por la base:
--  un hotelero paga y no recibe nada.
--
--  Hasta ahora eso pasaba en SILENCIO, porque el webhook no miraba el error y
--  respondía 200 — Stripe daba el evento por entregado y no reintentaba nunca.
--  Ese lado ya está arreglado en el código (K-04), pero sin este SQL el webhook
--  ahora fallaría con 500 en bucle. Los dos van juntos: PRIMERO este SQL.
--
--  Se conservan los tres valores viejos para no invalidar filas históricas.
-- ═══════════════════════════════════════════════════════════════════════════

-- Por si el constraint tuviera otro nombre, esto lo dice:
--   select conname from pg_constraint
--   where conrelid = 'public.suscripciones'::regclass and contype = 'c';

alter table public.suscripciones drop constraint if exists suscripciones_plan_check;

alter table public.suscripciones
  add constraint suscripciones_plan_check
  check (plan is null or plan in ('kora', 'boutique', 'hotel', 'grande'));

-- Comprobación: esto debe pasar sin error y luego deshacerse solo.
do $$
begin
  insert into public.suscripciones (user_id, plan, estado)
  values ('00000000-0000-0000-0000-000000000000', 'kora', 'incompleta');
  raise notice 'OK: la base ya acepta plan = kora';
  rollback;
exception when foreign_key_violation then
  raise notice 'OK: el CHECK del plan pasó (falló por la llave foránea del usuario de prueba, que es lo esperado)';
when check_violation then
  raise exception 'SIGUE ROTO: la base sigue rechazando plan = kora';
end $$;
