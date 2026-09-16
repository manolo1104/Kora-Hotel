-- ─────────────────────────────────────────────────────────────────────────────
-- Kora · El CRM del fundador pasa de mirar a MANDAR (15 sep 2026)
--
-- Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run.
--
-- QUÉ HACE, EN UNA FRASE: le da a /crm dónde apuntar lo que haces con sus
-- botones (bitácora), dónde guardar los interruptores que hoy son variables de
-- entorno (ajustes), cómo alargar la prueba de un hotel sin tocar fechas, una
-- bandeja para las alertas que hoy sólo llegan por correo, y un candado para
-- que un hotelero no se marque solo como «demo» desde el navegador.
--
-- ES IDEMPOTENTE: todo lleva `if not exists` o `create or replace`. Correrlo
-- dos veces no hace nada donde ya está aplicado y repara lo que falte. No hace
-- falta comprobar antes si ya se corrió: CORRERLO ES LA COMPROBACIÓN. No borra
-- ni modifica ninguna fila de ninguna tabla.
--
-- ── MIENTRAS NO ESTÉ CORRIDO ─────────────────────────────────────────────────
--
-- NADA se rompe. El código lo trata así:
--   · sin `crm_bitacora`  → los botones del CRM funcionan, pero no dejan rastro
--                           (y la pantalla lo avisa);
--   · sin `kora_ajustes`  → el prepago sigue mandado por las variables
--                           SALDO_RECARGA / SALDO_BLOQUEO de Vercel, como hoy;
--   · sin `dias_extra`    → la prueba dura lo de siempre; el botón de «+ días»
--                           avisa de que falta este archivo;
--   · sin `alertas_fundador` / `atendido_at` → las alertas siguen llegando por
--                           correo, sólo que no se pueden marcar como atendidas.
--
-- ⚠️  ANTES: `sql/kora-prueba-por-dueno.sql` (crea la tabla `pruebas`). Si no
--     está corrido, el bloque B de aquí lo dice y se salta; lo demás se aplica.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── BLOQUE A · bitácora de lo que hace el fundador ─────────────────────────
--
-- Hasta hoy el único botón del CRM que escribía (bloquear un hotel) dejaba un
-- `console.log` y nada más: ni quién, ni por qué, ni qué había antes. Ahora que
-- el CRM va a regalar saldo, alargar pruebas y encender el bloqueo de Camila,
-- «¿quién le dio 30 días a este hotel y por qué?» tiene que tener respuesta.
--
-- `hotel_id` SIN llave foránea a propósito: si el hotel se borra, lo que se hizo
-- con él tiene que seguir escrito. Por eso también se guarda `hotel_slug`, que
-- es lo que se reconoce a simple vista cuando el id ya no apunta a nada.

create table if not exists public.crm_bitacora (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  accion      text        not null,   -- 'saldo.regalar', 'prueba.dias_extra', …
  hotel_id    uuid,
  hotel_slug  text,
  user_id     uuid,                   -- el dueño afectado, cuando la acción es sobre una cuenta
  motivo      text,
  antes       jsonb,
  despues     jsonb,
  detalle     jsonb
);

create index if not exists crm_bitacora_fecha_idx on public.crm_bitacora (created_at desc);
create index if not exists crm_bitacora_hotel_idx on public.crm_bitacora (hotel_id);

-- RLS sin políticas + revoke: sólo el servidor (service-role) lee y escribe.
-- Los privilegios de Postgres son ADITIVOS: sin el revoke, una política creada
-- «para depurar» abriría la tabla entera (ver sql/kora-prueba-por-dueno.sql).
alter table public.crm_bitacora enable row level security;
revoke all on table public.crm_bitacora from public, anon, authenticated;

comment on table public.crm_bitacora is
  'Qué hizo el fundador desde /crm: acción, hotel, motivo, antes y después. '
  'Sin FK a hoteles a propósito: el rastro sobrevive al borrado del hotel.';


-- ─── BLOQUE B · días extra de prueba, por DUEÑO ─────────────────────────────
--
-- «Dame una semana más» no tenía forma de concederse. Mover `pruebas.inicio`
-- sería tocar el ancla que cierra la prueba infinita (y moverlo hacia atrás la
-- VENCE de golpe). Así que los días extra van en su propia columna y se SUMAN
-- al final: el inicio no se toca nunca.
--
-- Por dueño y no por hotel, igual que el ancla: si viviera en el hotel, borrar y
-- recrear el hotel los perdería (o los regalaría otra vez).
--
-- El tope de 365 es la red de un dedo: escribir 3000 en vez de 30 no puede
-- convertirse en diez años gratis.

do $$
begin
  if to_regclass('public.pruebas') is null then
    raise notice 'Bloque B saltado: falta la tabla pruebas. Corre primero sql/kora-prueba-por-dueno.sql y luego vuelve a correr este archivo.';
    return;
  end if;

  execute 'alter table public.pruebas add column if not exists dias_extra int not null default 0';

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pruebas'::regclass
       and conname  = 'pruebas_dias_extra_rango'
  ) then
    execute 'alter table public.pruebas
               add constraint pruebas_dias_extra_rango check (dias_extra between 0 and 365)';
  end if;
end $$;


-- ─── BLOQUE C · ajustes de la plataforma ────────────────────────────────────
--
-- Los dos interruptores del prepago (abrir recargas / callar a Camila sin
-- saldo) eran variables de entorno: encenderlos exigía entrar a Vercel y
-- redesplegar. Ahora viven aquí, en la fila `saldo_fases`, y se mueven con un
-- botón del CRM.
--
-- SIN SEMILLA a propósito: mientras no haya fila, el código usa las variables
-- de siempre. Así correr este archivo no cambia NADA de lo que pasa hoy; el
-- primer cambio lo hace el primer clic.

create table if not exists public.kora_ajustes (
  clave      text        primary key,
  valor      jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.kora_ajustes enable row level security;
revoke all on table public.kora_ajustes from public, anon, authenticated;

comment on table public.kora_ajustes is
  'Interruptores de la plataforma que se mueven desde /crm. Sin fila = manda la '
  'variable de entorno de siempre. saldo_fases = {recarga:boolean, bloqueo:boolean}.';


-- ─── BLOQUE D · bandeja de alertas del fundador ─────────────────────────────
--
-- `alertar()` (lib/alertas.ts) sólo manda un correo: si ese correo se pierde, no
-- queda rastro de que un cobro cayó en la cuenta de Kora o de que un webhook
-- falló. Aquí se guardan para verlas en /crm y marcarlas como atendidas.

create table if not exists public.alertas_fundador (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  asunto      text        not null,
  detalle     text,
  atendida_at timestamptz
);

create index if not exists alertas_fundador_fecha_idx on public.alertas_fundador (created_at desc);
-- La bandeja lee las pendientes (`atendida_at is null`) y ordena las atendidas
-- por `atendida_at`. Con la tabla pequeña da igual; con meses de alertas dentro,
-- sin este índice cada carga de /crm/bandeja recorre la tabla entera.
create index if not exists alertas_fundador_atendida_idx on public.alertas_fundador (atendida_at desc);

alter table public.alertas_fundador enable row level security;
revoke all on table public.alertas_fundador from public, anon, authenticated;


-- ─── BLOQUE E · chats de soporte atendidos ──────────────────────────────────
--
-- El CRM cuenta los chats escalados de los últimos 7 días, pero no hay forma de
-- decir «este ya lo contesté»: la alerta seguía encendida toda la semana. Con
-- esta marca, la bandeja enseña sólo los pendientes.

do $$
begin
  if to_regclass('public.soporte_conversaciones') is null then
    raise notice 'Bloque E saltado: falta la tabla soporte_conversaciones. Corre primero sql/kora-soporte-schema.sql.';
    return;
  end if;
  execute 'alter table public.soporte_conversaciones add column if not exists atendido_at timestamptz';
end $$;


-- ─── BLOQUE F · el hotelero no puede marcarse «demo» solo ───────────────────
--
-- `extras.demo = true` hace que la prueba NUNCA caduque (lib/suscripcion.ts) y
-- que el motor simule el pago. El trigger de sql/kora-e5-aislamiento.sql sólo
-- protegía `extras.bloqueo`, así que cualquier dueño podía ponerse `demo` desde
-- la consola del navegador y tener el panel gratis para siempre.
--
-- Ahora las DOS llaves son de Kora: el navegador del hotelero no puede ponerlas,
-- quitarlas ni cambiarlas. El servidor (service-role) sí, que es por donde las
-- escribe el CRM.
--
-- Y también al CREAR el hotel, no sólo al editarlo: la política
-- "hoteles insertar propio" deja a cualquier usuario insertar su propio hotel
-- directo contra la base, y un INSERT con `extras: {demo: true}` se saltaba el
-- trigger de UPDATE entero. Ningún alta legítima del navegador trae esas llaves
-- (`app/api/panel/crear-hotel` no toca `extras`), así que quitarlas no rompe nada.
--
-- El cuerpo del UPDATE es EXACTAMENTE el de sql/kora-e5-aislamiento.sql, con
-- `demo` añadida junto a `bloqueo`.

create or replace function public.hoteles_proteger_columnas()
returns trigger language plpgsql as $$
begin
  -- El servidor de Kora (service-role) y el admin de la base pasan de largo.
  if coalesce(auth.jwt()->>'role','') = 'service_role'
     or current_user in ('postgres','supabase_admin','service_role') then
    return new;
  end if;

  -- Alta desde el navegador: las llaves de Kora no se traen puestas de casa.
  if tg_op = 'INSERT' then
    new.extras := coalesce(new.extras, '{}'::jsonb) - 'bloqueo' - 'demo';
    return new;
  end if;

  new.id                := old.id;
  new.owner_id          := old.owner_id;
  new.slug              := old.slug;
  new.stripe_account_id := old.stripe_account_id;
  new.created_at        := old.created_at;
  new.config            := old.config;   -- email_from, bot_enabled, precios…

  -- De `extras`, las llaves `bloqueo` y `demo` son de Kora, no del hotel.
  new.extras := (new.extras - 'bloqueo' - 'demo')
    || (case when old.extras ? 'bloqueo'
             then jsonb_build_object('bloqueo', old.extras->'bloqueo')
             else '{}'::jsonb end)
    || (case when old.extras ? 'demo'
             then jsonb_build_object('demo', old.extras->'demo')
             else '{}'::jsonb end);
  return new;
end;
$$;

-- El de UPDATE ya existía (e5); se recrea por si este archivo se corre en una
-- base donde e5 no llegó a correrse.
drop trigger if exists hoteles_proteger on public.hoteles;
create trigger hoteles_proteger before update on public.hoteles
  for each row execute function public.hoteles_proteger_columnas();

drop trigger if exists hoteles_proteger_alta on public.hoteles;
create trigger hoteles_proteger_alta before insert on public.hoteles
  for each row execute function public.hoteles_proteger_columnas();


-- ─── COMPROBACIÓN ───────────────────────────────────────────────────────────
-- Una fila por pieza. Todo tiene que salir con ✅.

select 'A · bitácora del CRM' as pieza,
       case when to_regclass('public.crm_bitacora') is not null then 'existe ✅' else 'NO EXISTE ❌' end as estado
union all
select 'A2 · bitácora cerrada al navegador',
       case when to_regclass('public.crm_bitacora') is null then 'NO EXISTE ❌'
            when has_table_privilege('anon', 'public.crm_bitacora', 'SELECT')
              or has_table_privilege('authenticated', 'public.crm_bitacora', 'INSERT')
            then 'el navegador TODAVÍA tiene permisos ❌' else 'permisos revocados ✅' end
union all
select 'B · días extra de prueba',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'pruebas'
                            and column_name = 'dias_extra')
            then 'columna puesta ✅'
            else 'FALTA (¿corriste sql/kora-prueba-por-dueno.sql?) ❌' end
union all
select 'B2 · tope de 0 a 365 días',
       case when exists (select 1 from pg_constraint where conname = 'pruebas_dias_extra_rango')
            then 'puesto ✅' else 'FALTA ❌' end
union all
select 'C · ajustes de la plataforma',
       case when to_regclass('public.kora_ajustes') is null then 'NO EXISTE ❌'
            when has_table_privilege('anon', 'public.kora_ajustes', 'SELECT')
              or has_table_privilege('authenticated', 'public.kora_ajustes', 'UPDATE')
            then 'el navegador TODAVÍA tiene permisos ❌' else 'existe y cerrada ✅' end
union all
select 'D · bandeja de alertas',
       case when to_regclass('public.alertas_fundador') is null then 'NO EXISTE ❌'
            when has_table_privilege('anon', 'public.alertas_fundador', 'SELECT')
              or has_table_privilege('authenticated', 'public.alertas_fundador', 'INSERT')
            then 'el navegador TODAVÍA tiene permisos ❌' else 'existe y cerrada ✅' end
union all
select 'E · chats marcables como atendidos',
       case when exists (select 1 from information_schema.columns
                          where table_schema = 'public' and table_name = 'soporte_conversaciones'
                            and column_name = 'atendido_at')
            then 'columna puesta ✅'
            else 'FALTA (¿corriste sql/kora-soporte-schema.sql?) ❌' end
union all
select 'F · «demo» protegida en el trigger',
       case when pg_get_functiondef('public.hoteles_proteger_columnas()'::regprocedure) like '%- ''demo''%'
            then 'protegida ✅' else 'SIN PROTEGER ❌' end
union all
select 'F2 · triggers de edición y de alta',
       case when (select count(*) from pg_trigger
                   where tgrelid = 'public.hoteles'::regclass
                     and tgname in ('hoteles_proteger', 'hoteles_proteger_alta')) = 2
            then 'los dos puestos ✅' else 'FALTA alguno ❌' end;


-- ─── CÓMO SE DESHACE ────────────────────────────────────────────────────────
-- Todo es inmediato. Los datos del CRM (bitácora, ajustes, alertas) se pierden
-- al borrar su tabla; lo demás no pierde nada.
--
--   -- A: sin bitácora (los botones siguen funcionando, sin rastro)
--   drop table if exists public.crm_bitacora;
--
--   -- B: la prueba vuelve a durar lo de siempre para todos
--   alter table public.pruebas drop constraint if exists pruebas_dias_extra_rango;
--   alter table public.pruebas drop column if exists dias_extra;
--
--   -- C: el prepago vuelve a mandarse con SALDO_RECARGA / SALDO_BLOQUEO.
--   --    ⚠️ Revisa esas variables en Vercel ANTES: si SALDO_BLOQUEO=1 quedó
--   --    puesto de hace tiempo, borrar la tabla lo vuelve a encender.
--   drop table if exists public.kora_ajustes;
--
--   -- D y E
--   drop table if exists public.alertas_fundador;
--   alter table public.soporte_conversaciones drop column if exists atendido_at;
--
--   -- F: volver a proteger sólo `bloqueo` = correr otra vez el bloque C de
--   --    sql/kora-e5-aislamiento.sql, y quitar el trigger de alta:
--   drop trigger if exists hoteles_proteger_alta on public.hoteles;
