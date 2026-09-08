-- ─────────────────────────────────────────────────────────────────────────────
-- Kora · Saldo prepago del bot de WhatsApp
--
-- Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run.
--
-- ES IDEMPOTENTE: todo lleva `if not exists` o `create or replace`. Correrlo de
-- nuevo no hace nada donde ya está aplicado y repara lo que falte. No hace falta
-- comprobar antes si ya se corrió: CORRERLO ES LA COMPROBACIÓN. No borra ni
-- modifica ninguna fila de ninguna otra tabla.
--
-- ── QUÉ GUARDA Y POR QUÉ ─────────────────────────────────────────────────────
--
-- Cada respuesta que Camila le manda a un huésped le cuesta dinero a Kora en
-- tokens de Anthropic (~$0.0092 USD por mensaje, medido). Hasta hoy eso no se
-- cobraba ni se medía. Aquí vive el saldo prepago: el hotelero recarga mensajes,
-- cada respuesta de Camila resta uno, y si se acaba, Camila se calla.
--
-- La unidad es el MENSAJE ENTERO, no el dinero. Una recarga de $100 MXN acredita
-- exactamente 300; consumir es restar 1. Sin decimales, sin redondeos, sin
-- deriva de coma flotante. El precio en pesos vive sólo en el checkout de
-- Stripe (`lib/saldo/paquetes.ts`): qué compra cada importe.
--
-- ── FAIL-SAFE: QUÉ PASA MIENTRAS ESTO NO ESTÉ CORRIDO ────────────────────────
--
-- NADA se rompe. `lib/db/saldo.ts` trata la tabla ausente y la función
-- inexistente (42883 / PGRST202) como «no hay saldo que comprobar» y el bot
-- sigue contestando igual que hoy. Correr este SQL enciende la medición; el
-- bloqueo se enciende aparte, con la variable `SALDO_BLOQUEO`.
--
-- ── ORDEN DE PUESTA EN MARCHA ────────────────────────────────────────────────
--
--   1. Correr esto.
--   2. `node scripts/regalar-saldo.mjs --enviar`  (300 mensajes a cada hotel).
--   3. Desplegar el código, con `SALDO_BLOQUEO` SIN PONER (mide, no calla).
--   4. Verificar en producción que el saldo baja al ritmo real.
--   5. Poner `SALDO_BLOQUEO=1` en Vercel.
--
-- Al revés, los hoteles registrados se quedan mudos el día del despliegue.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. El saldo ────────────────────────────────────────────────────────────────
--
-- Una fila por hotel. `mensajes` nunca baja de cero (lo garantiza el CHECK y
-- además el `greatest(0, …)` de la función: dos redes distintas para lo mismo,
-- porque un saldo negativo se traduciría en un hotel que no puede recargar).

create table if not exists public.saldo_bot (
  hotel_id      uuid        primary key references public.hoteles(id) on delete cascade,
  mensajes      int         not null default 0 check (mensajes >= 0),
  -- Marcas de los dos correos de aviso. Se ponen al mandar el correo y las
  -- BORRA `saldo_acreditar`: por eso una recarga vuelve a habilitar los avisos
  -- para la próxima vez que se acabe.
  aviso_bajo_at timestamptz,
  aviso_cero_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.saldo_bot is
  'Saldo prepago del bot de WhatsApp, en MENSAJES enteros (no en dinero). '
  'Una fila por hotel. Un hotel SIN fila aquí NO se bloquea: la ausencia nunca '
  'significa "sin saldo", porque un regalo que no se aplicó dejaría mudo a un '
  'hotel que paga.';


-- 2. El libro de movimientos ─────────────────────────────────────────────────
--
-- Cada consumo y cada recarga deja su renglón. Sirve para dos cosas:
--
--  a) Enseñarle al hotelero en qué se le fue el saldo.
--  b) LA IDEMPOTENCIA. El `unique index` sobre (hotel_id, ref) es lo que impide
--     cobrar dos veces el mismo mensaje y acreditar dos veces la misma recarga.
--     El `ref` del consumo es el id del mensaje de WhatsApp; el de la recarga,
--     el `session.id` de Stripe. Es exactamente el hueco que hoy tiene el correo
--     de bienvenida en `app/api/stripe/webhook/route.ts`, que se manda otra vez
--     en cada reentrega del evento.
--
-- `ref` vacío se permite (el índice es parcial) para no perder un consumo cuando
-- WhatsApp no devuelve id: mejor cobrar sin red de dedupe que no cobrar.

create table if not exists public.saldo_movimientos (
  id         uuid        primary key default gen_random_uuid(),
  hotel_id   uuid        not null references public.hoteles(id) on delete cascade,
  tipo       text        not null,   -- 'consumo' | 'recarga' | 'regalo' | 'ajuste'
  mensajes   int         not null,   -- +N al acreditar, -1 al consumir
  ref        text        not null default '',
  created_at timestamptz not null default now()
);

-- Sin `check` sobre `tipo` a propósito, igual que en `agent_activity`: un tipo
-- nuevo no puede convertirse en un error de escritura que tumbe una respuesta.

create unique index if not exists saldo_mov_ref_idx
  on public.saldo_movimientos (hotel_id, ref)
  where ref <> '';

-- Para el resumen de consumo del panel: barrer un hotel por fecha.
create index if not exists saldo_mov_hotel_fecha_idx
  on public.saldo_movimientos (hotel_id, created_at desc);

-- Nadie con la llave del navegador toca esto. Si `anon` pudiera escribir aquí,
-- se regalaría saldo solo.
alter table public.saldo_bot          enable row level security;
alter table public.saldo_movimientos  enable row level security;
revoke all on table public.saldo_bot         from public, anon, authenticated;
revoke all on table public.saldo_movimientos from public, anon, authenticated;


-- 3. Consumir un mensaje ─────────────────────────────────────────────────────
--
-- Resta UNO y devuelve el saldo que queda. Atómica: el `insert … on conflict`
-- del movimiento y el `update … returning` del saldo pasan en la MISMA
-- transacción, y el `update` sobre la clave primaria toma el candado de la fila
-- —la misma garantía que documenta `rl_consumir` en el limitador—, así que dos
-- mensajes simultáneos del mismo hotel no pueden leer el mismo saldo y escribir
-- el mismo −1.
--
-- SIN `pg_advisory_xact_lock`. El repo lo usa en las tres funciones de reservas
-- (`kora-e3-apartado-atomico.sql`), todas sobre `hashtext(hotel_id)`. Usarlo
-- aquí serializaría CADA RESPUESTA DEL BOT detrás de la creación de reservas del
-- mismo hotel, que es justo lo que no se quiere en el camino caliente.
--
-- Devuelve el saldo restante. `-1` significa «este hotel no tiene fila»: quien
-- llama lo trata como "no hay nada que cobrar", NUNCA como "sin saldo".

create or replace function public.saldo_consumir(
  p_hotel_id uuid,
  p_ref      text default ''
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo int;
  v_mov   uuid;
begin
  if p_hotel_id is null then
    raise exception 'HOTEL_REQUERIDO' using errcode = 'invalid_parameter_value';
  end if;

  -- El renglón del libro va PRIMERO, y es quien decide si esto es una
  -- repetición. Si el `ref` ya estaba, `do nothing` no inserta, `v_mov` se queda
  -- en NULL y no se cobra.
  insert into public.saldo_movimientos (hotel_id, tipo, mensajes, ref)
       values (p_hotel_id, 'consumo', -1, coalesce(p_ref, ''))
  on conflict (hotel_id, ref) where ref <> '' do nothing
    returning id into v_mov;

  if v_mov is null then
    -- Ya se había cobrado este mensaje. Devolver el saldo actual sin tocarlo.
    select mensajes into v_nuevo from public.saldo_bot where hotel_id = p_hotel_id;
    return coalesce(v_nuevo, -1);
  end if;

  update public.saldo_bot
     set mensajes   = greatest(0, mensajes - 1),
         updated_at = now()
   where hotel_id = p_hotel_id
   returning mensajes into v_nuevo;

  -- Sin fila de saldo: el hotel no está dado de alta en el prepago. Se deshace
  -- el renglón del libro para no dejar un consumo que no descontó de nada.
  --
  -- SE BORRA POR `id`, no por `ref`. Buscarlo por `ref` dejaba huérfano el
  -- renglón de los mensajes SIN ref (WhatsApp no siempre devuelve el id), y esos
  -- huérfanos se cuentan como consumo: el panel le enseñaría a un hotel sin
  -- prepago que gastó mensajes que nunca se le cobraron.
  if v_nuevo is null then
    delete from public.saldo_movimientos where id = v_mov;
    return -1;
  end if;

  return v_nuevo;
end;
$$;

revoke all on function public.saldo_consumir(uuid, text) from public, anon, authenticated;


-- 4. Acreditar mensajes ──────────────────────────────────────────────────────
--
-- Recarga, regalo o ajuste. Mismo esquema de dedupe por `ref`, que aquí es lo
-- que impide que una reentrega del webhook de Stripe acredite dos veces.
--
-- Además BORRA las dos marcas de aviso: es lo que hace que los correos de «te
-- queda poco» y «se acabó» puedan volver a mandarse la próxima vez.
--
-- Devuelve el saldo nuevo, o `-1` si el `ref` ya se había aplicado (repetición).

create or replace function public.saldo_acreditar(
  p_hotel_id uuid,
  p_mensajes int,
  p_ref      text default '',
  p_tipo     text default 'recarga'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nuevo int;
  v_ins   int;
begin
  if p_hotel_id is null then
    raise exception 'HOTEL_REQUERIDO' using errcode = 'invalid_parameter_value';
  end if;
  if p_mensajes is null or p_mensajes < 1 then
    raise exception 'MENSAJES_INVALIDOS: %', p_mensajes using errcode = 'invalid_parameter_value';
  end if;

  insert into public.saldo_movimientos (hotel_id, tipo, mensajes, ref)
       values (p_hotel_id, coalesce(nullif(btrim(p_tipo), ''), 'recarga'), p_mensajes, coalesce(p_ref, ''))
  on conflict (hotel_id, ref) where ref <> '' do nothing;

  get diagnostics v_ins = row_count;
  if v_ins = 0 then
    return -1;  -- ya se había acreditado este `ref`
  end if;

  insert into public.saldo_bot as s (hotel_id, mensajes)
       values (p_hotel_id, p_mensajes)
  on conflict (hotel_id) do update
       set mensajes      = s.mensajes + p_mensajes,
           aviso_bajo_at = null,
           aviso_cero_at = null,
           updated_at    = now()
    returning s.mensajes into v_nuevo;

  return v_nuevo;
end;
$$;

revoke all on function public.saldo_acreditar(uuid, int, text, text) from public, anon, authenticated;


-- 5. Reclamar el turno de mandar un correo ───────────────────────────────────
--
-- Devuelve `true` UNA sola vez: quien lo reciba es quien manda el correo. Es el
-- mismo patrón de «reclamar la fila ANTES de enviar» que usa el cron de dunning
-- (`app/api/cron/dunning/route.ts`), y aquí hace falta de verdad porque el aviso
-- se dispara desde el camino del bot: tres mensajes simultáneos del mismo hotel
-- cruzarían el umbral a la vez y mandarían tres correos.
--
-- `p_cual` = 'bajo' | 'cero'.

create or replace function public.saldo_reclamar_aviso(
  p_hotel_id uuid,
  p_cual     text,
  p_umbral   int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_cual = 'bajo' then
    update public.saldo_bot
       set aviso_bajo_at = now(), updated_at = now()
     where hotel_id = p_hotel_id
       and aviso_bajo_at is null
       and mensajes <= p_umbral
     returning hotel_id into v_id;
  elsif p_cual = 'cero' then
    update public.saldo_bot
       set aviso_cero_at = now(), updated_at = now()
     where hotel_id = p_hotel_id
       and aviso_cero_at is null
       and mensajes <= 0
     returning hotel_id into v_id;
  else
    raise exception 'AVISO_INVALIDO: %', p_cual using errcode = 'invalid_parameter_value';
  end if;

  return v_id is not null;
end;
$$;

revoke all on function public.saldo_reclamar_aviso(uuid, text, int) from public, anon, authenticated;


-- 6. Comprobación ────────────────────────────────────────────────────────────
--
-- Si algo faltó, esto lanza y lo dice por su nombre.

do $$
declare
  faltan text := '';
begin
  if to_regclass('public.saldo_bot') is null then
    faltan := faltan || 'tabla saldo_bot, ';
  end if;
  if to_regclass('public.saldo_movimientos') is null then
    faltan := faltan || 'tabla saldo_movimientos, ';
  end if;
  if to_regprocedure('public.saldo_consumir(uuid, text)') is null then
    faltan := faltan || 'función saldo_consumir, ';
  end if;
  if to_regprocedure('public.saldo_acreditar(uuid, int, text, text)') is null then
    faltan := faltan || 'función saldo_acreditar, ';
  end if;
  if to_regprocedure('public.saldo_reclamar_aviso(uuid, text, int)') is null then
    faltan := faltan || 'función saldo_reclamar_aviso, ';
  end if;
  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public' and indexname = 'saldo_mov_ref_idx'
  ) then
    faltan := faltan || 'índice saldo_mov_ref_idx (SIN ÉL SE COBRA DOBLE), ';
  end if;

  if faltan <> '' then
    raise exception 'Falta: %', rtrim(faltan, ', ');
  end if;

  raise notice 'OK: saldo prepago listo. Ahora corre scripts/regalar-saldo.mjs ANTES de desplegar.';
end $$;
