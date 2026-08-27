-- ============================================================================
--  Kora · Etapa 2, paso 2.3 — el CHECK del plan dice lo que el código escribe
--
--  Se aplica A MANO en el editor SQL de Supabase. Idempotente: se puede correr
--  las veces que haga falta.
--
--  HISTORIA. La tabla nació con tres planes (boutique/hotel/grande) y el código
--  escribe 'kora'. Con el CHECK viejo, TODA alta de suscripción se rechazaba: el
--  hotelero pagaba y no recibía nada (K-05, K-07). Eso ya se destrabó el 25 ago
--  con `kora-plan-check.sql`, que añadió 'kora' CONSERVANDO los tres viejos.
--
--  Esto es el cierre: 'kora' es el único plan que existe (lib/oferta.ts), así que
--  la base deja de admitir tres valores que ninguna parte del producto sabe
--  interpretar — y que además rompen el cálculo de MRR del digest.
--
--  ⚠️ MIRA ESTO ANTES DE CORRER EL ALTER. Si devuelve alguna fila, hay
--     suscripciones con un plan viejo y el ALTER fallará (error 23514). En ese
--     caso: decide si migrarlas (`update ... set plan='kora'`) o quédate con el
--     CHECK de hoy.
-- ============================================================================

select plan, estado, count(*) as filas
  from public.suscripciones
 where plan is not null and plan <> 'kora'
 group by plan, estado;


-- ─── El CHECK ───────────────────────────────────────────────────────────────
-- `plan is null` se sigue admitiendo a propósito: las filas de hoy lo tienen
-- NULL (el webhook lo rellena al activarse), y prohibirlo rompería las altas.
alter table public.suscripciones drop constraint if exists suscripciones_plan_check;
alter table public.suscripciones add constraint suscripciones_plan_check
  check (plan is null or plan = 'kora');


-- ─── COMPROBACIÓN ───────────────────────────────────────────────────────────
-- Se espera:  CHECK ((plan IS NULL) OR (plan = 'kora'::text))
select pg_get_constraintdef(oid) as check_del_plan
  from pg_constraint
 where conrelid = 'public.suscripciones'::regclass
   and conname  = 'suscripciones_plan_check';


-- ─── CÓMO SE DESHACE ────────────────────────────────────────────────────────
--   alter table public.suscripciones drop constraint suscripciones_plan_check;
--   alter table public.suscripciones add constraint suscripciones_plan_check
--     check (plan is null or plan in ('kora','boutique','hotel','grande'));
