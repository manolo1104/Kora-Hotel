-- ============================================================================
--  Kora · Etapa 2 — la tabla `suscripciones` se pone al día (pasos 2.3 y 2.14)
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


-- ─── PASO 2.14 · la guarda de "ya le escribí hoy" (K-193) ───────────────────
--
-- El cron de dunning subía `avisos_dunning` en CADA pasada. Dos invocaciones el
-- mismo día —un `curl` suelto, un redespliegue— le vaciaban los 3 avisos de
-- golpe al cliente, y le llegaba entera en unas horas la secuencia de "no
-- pudimos cobrarte", que es el correo más delicado que manda Kora.
--
-- El código YA está desplegado y NO depende de esta columna: si no existe,
-- trabaja sin guarda y lo dice en el log (y en la respuesta del cron, como
-- `sinGuardaDeDia: true`). Correr esto es lo que cierra el hueco.
alter table public.suscripciones
  add column if not exists ultimo_aviso_dunning date;

comment on column public.suscripciones.ultimo_aviso_dunning is
  'Último día en que se le mandó un aviso de pago vencido. Impide que dos pasadas '
  'del cron el mismo día manden dos correos al mismo cliente.';


-- ─── COMPROBACIÓN DEL 2.14 ──────────────────────────────────────────────────
select 'columna ultimo_aviso_dunning' as bloque,
       case when exists (
         select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'suscripciones'
            and column_name = 'ultimo_aviso_dunning'
       ) then 'creada ✅' else 'FALTA ❌' end as valor;


-- ─── CÓMO SE DESHACE ────────────────────────────────────────────────────────
--   alter table public.suscripciones drop constraint suscripciones_plan_check;
--   alter table public.suscripciones add constraint suscripciones_plan_check
--     check (plan is null or plan in ('kora','boutique','hotel','grande'));
--   alter table public.suscripciones drop column ultimo_aviso_dunning;
