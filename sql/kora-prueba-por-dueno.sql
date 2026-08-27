-- ============================================================================
--  Kora · Etapa 2, paso 2.11 — la prueba deja de ser infinita (26 ago 2026)
--
--  Se aplica A MANO en el editor SQL de Supabase. No hay herramienta de
--  migraciones en este repo: manda lo aplicado, no este archivo.
--
--  EL PROBLEMA (K-108, K-258, K-315). La prueba de 30 días se derivaba de
--  `hoteles.created_at`, y el panel deja borrar un hotel y volver a crearlo. O
--  sea: borras, recreas, y arrancan otros 30 días gratis — indefinidamente y sin
--  tocar nada raro. El ancla no puede vivir en algo que el propio usuario puede
--  destruir.
--
--  EL CÓDIGO YA ESTÁ DESPLEGADO Y NO DEPENDE DE ESTE ARCHIVO: mientras la tabla
--  no exista, todo se comporta como siempre (cae al `created_at`). Correr esto
--  es lo que CIERRA el agujero; no correrlo no rompe nada, sólo lo deja abierto.
--
--  Los tres bloques son independientes y se pueden correr de una sentada.
-- ============================================================================


-- ─── BLOQUE A · el ancla de la prueba, por DUEÑO ────────────────────────────
-- Una fila por dueño, escrita la PRIMERA vez y nunca borrada. `on delete
-- cascade` contra auth.users es a propósito: si la cuenta desaparece de verdad,
-- el ancla ya no significa nada. Borrar un HOTEL no la toca, que es el punto.
create table if not exists public.pruebas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inicio  timestamptz not null default now()
);

-- Sin ninguna policy: RLS activo y cero políticas = sólo la service-role la ve
-- (mismo patrón que `hotel_bot_tokens`). El navegador no tiene nada que hacer
-- aquí, y si pudiera leerla sabría cuándo se le acaba la prueba a cualquiera.
alter table public.pruebas enable row level security;

-- Y ADEMÁS se le quitan los permisos al rol del navegador. RLS sin políticas ya
-- bloquea, pero los privilegios de Postgres son ADITIVOS y esto es una capa que
-- no depende de que nadie añada una política por error: si mañana alguien crea
-- una policy "para depurar", sin este revoke la tabla se abre entera.
--
-- Es exactamente el blindaje que ya tiene `hotel_bot_tokens`, y se nota desde
-- fuera: con la llave anónima, una tabla sólo-RLS contesta `[]` (y así confirma
-- que existe) mientras que una con el revoke contesta 42501 permission denied.
revoke all on public.pruebas from anon, authenticated;

comment on table public.pruebas is
  'Ancla de la prueba de 30 días, por dueño. Se escribe una vez y NUNCA se borra: '
  'si viviera en hoteles.created_at, borrar y recrear el hotel regalaría otros 30 días.';


-- ─── BLOQUE B · rellenar con lo que ya hay ──────────────────────────────────
-- A cada dueño se le ancla la prueba en su hotel MÁS ANTIGUO. Nadie pierde días
-- por este cambio: es exactamente la fecha con la que se le venía calculando.
-- `on conflict do nothing` lo hace repetible sin efectos.
insert into public.pruebas (user_id, inicio)
select owner_id, min(created_at)
  from public.hoteles
 where owner_id is not null and created_at is not null
 group by owner_id
on conflict (user_id) do nothing;


-- ─── BLOQUE C · una cuenta = un hotel, también en la base ───────────────────
--
-- La decisión de negocio (26 ago 2026) es que el cobro es POR CUENTA y el alta
-- se limita a UN hotel. `lib/suscripcion.ts` ya concede el acceso por
-- `owner_id`, así que la base tiene que dejar de decir lo contrario:
--
--   1) `suscripciones_hotel_uidx` viene con el comentario "un plan por hotel",
--      que es justo el modelo que NO se eligió.
--   2) `suscripciones.hotel_id` es `on delete cascade`. Con eso, borrar un hotel
--      se llevaba por delante la fila de la suscripción — y con ella el
--      `stripe_subscription_id` de una suscripción que en Stripe sigue viva
--      hasta el corte del periodo. Kora la olvidaba y, si el dueño daba de alta
--      otro hotel esa misma semana, el checkout le abría una SEGUNDA
--      cobrándole dos veces.
--
-- El código ya suelta ese vínculo antes de borrar (app/api/panel/eliminar-hotel);
-- esto es la red de seguridad para cualquier otro camino de borrado.
drop index if exists public.suscripciones_hotel_uidx;

do $$
declare
  nombre_fk text;
begin
  select conname into nombre_fk
    from pg_constraint
   where conrelid = 'public.suscripciones'::regclass
     and contype  = 'f'
     and conkey   = array[(select attnum from pg_attribute
                            where attrelid = 'public.suscripciones'::regclass
                              and attname  = 'hotel_id')];
  if nombre_fk is not null then
    execute format('alter table public.suscripciones drop constraint %I', nombre_fk);
    execute 'alter table public.suscripciones
               add constraint suscripciones_hotel_id_fkey
               foreign key (hotel_id) references public.hoteles(id) on delete set null';
  end if;
end $$;


-- ─── COMPROBACIÓN · una fila por bloque ─────────────────────────────────────
-- A: cuántos dueños quedaron anclados (debe coincidir con los dueños distintos
--    de `hoteles`). B: que el índice "un plan por hotel" ya no está.
-- C: que la FK dice SET NULL (`confdeltype = 'n'`) y no CASCADE (`'c'`).
select 'A · dueños anclados' as bloque,
       (select count(*)::text from public.pruebas) || ' de ' ||
       (select count(distinct owner_id)::text from public.hoteles where owner_id is not null) as valor
union all
select 'A2 · pruebas fuera del alcance del navegador',
       case when has_table_privilege('anon', 'public.pruebas', 'SELECT')
             or has_table_privilege('anon', 'public.pruebas', 'DELETE')
            then 'anon TODAVÍA tiene permisos ❌' else 'permisos revocados ✅' end
union all
select 'B · índice un-plan-por-hotel',
       case when to_regclass('public.suscripciones_hotel_uidx') is null
            then 'borrado ✅' else 'SIGUE AHÍ ❌' end
union all
select 'C · FK suscripciones.hotel_id',
       coalesce((select case confdeltype when 'n' then 'set null ✅'
                                         when 'c' then 'CASCADE ❌'
                                         else confdeltype::text end
                   from pg_constraint
                  where conrelid = 'public.suscripciones'::regclass and contype = 'f'
                    and conkey = array[(select attnum from pg_attribute
                                         where attrelid = 'public.suscripciones'::regclass
                                           and attname = 'hotel_id')]),
                'no hay columna hotel_id');


-- ─── CÓMO SE DESHACE ────────────────────────────────────────────────────────
--   Bloque A/B:  drop table public.pruebas;   -- se vuelve al created_at
--   Bloque C:    create unique index suscripciones_hotel_uidx
--                  on public.suscripciones (hotel_id) where hotel_id is not null;
--                (y volver a poner la FK con `on delete cascade`, si se quisiera)
