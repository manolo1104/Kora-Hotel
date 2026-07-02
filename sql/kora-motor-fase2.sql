-- ═══════════════════════════════════════════════════════════════════════════
-- KORA — Motor de reservas FASE 2 (rate plans + captura de abandono)
-- Pegar en Supabase SQL Editor DESPUÉS de kora-multitenant-fase0/fase1.
-- Idempotente: se puede correr más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Rate plan en reservas ──────────────────────────────────────────────
-- 'flex' (default) o 'nrf' (tarifa no reembolsable con descuento).
alter table public.bookings add column if not exists rate_plan text;

-- ── 2) RPC crear_reserva_atomica con rate_plan ────────────────────────────
-- Se agrega p_rate_plan al final. Postgres identifica funciones por firma, así
-- que hay que tirar la vieja para no dejar un overload ambiguo para PostgREST.
drop function if exists public.crear_reserva_atomica(
  uuid, text[], date, date, text, text, text, text, numeric, numeric, int,
  text, text, text, text, text
);

create or replace function public.crear_reserva_atomica(
  p_hotel_id          uuid,
  p_habitaciones      text[],
  p_checkin           date,
  p_checkout          date,
  p_confirmacion      text,
  p_cliente           text   default null,
  p_telefono          text   default null,
  p_email             text   default null,
  p_total             numeric default 0,
  p_anticipo          numeric default 0,
  p_huespedes         int    default 1,
  p_payment_intent_id text   default null,
  p_estado            text   default 'CONFIRMADA',
  p_origen            text   default 'web',
  p_como_nos_conocio  text   default null,
  p_notas             text   default null,
  p_rate_plan         text   default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_room       text;
  v_existing   uuid;
begin
  -- Idempotencia: si ya existe la reserva de este pago, devolverla.
  if p_payment_intent_id is not null then
    select id into v_existing from public.bookings
     where hotel_id = p_hotel_id and payment_intent_id = p_payment_intent_id;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  -- Serializar la creación de reservas de ESTE hotel.
  perform pg_advisory_xact_lock(hashtext(p_hotel_id::text));

  -- Verificar solape por cuarto contra bloqueos activos (holds vencidos no cuentan).
  foreach v_room in array p_habitaciones loop
    if exists (
      select 1 from public.blocks b
       where b.hotel_id = p_hotel_id
         and b.habitacion = v_room
         and b.checkin < p_checkout
         and p_checkin < b.checkout
         and (b.expires_at is null or b.expires_at > now())
    ) then
      raise exception 'CUARTO_NO_DISPONIBLE: %', v_room
        using errcode = 'check_violation';
    end if;
  end loop;

  -- Insertar la reserva.
  insert into public.bookings (
    hotel_id, confirmacion, cliente, telefono, email, checkin, checkout,
    noches, huespedes, habitaciones, total, anticipo, payment_intent_id,
    estado, origen, como_nos_conocio, notas, rate_plan
  ) values (
    p_hotel_id, p_confirmacion, p_cliente, p_telefono, p_email, p_checkin, p_checkout,
    (p_checkout - p_checkin), p_huespedes, array_to_string(p_habitaciones, ', '),
    p_total, p_anticipo, p_payment_intent_id,
    p_estado, p_origen, p_como_nos_conocio, p_notas, p_rate_plan
  )
  returning id into v_booking_id;

  -- Un bloqueo 'RESERVADO' por cuarto (fuente de verdad de ocupación).
  foreach v_room in array p_habitaciones loop
    insert into public.blocks (hotel_id, habitacion, checkin, checkout, status, booking_id)
    values (p_hotel_id, v_room, p_checkin, p_checkout, 'RESERVADO', v_booking_id);
  end loop;

  return v_booking_id;
end;
$$;

-- ── 3) Intentos de reserva (captura temprana de email → recuperación de
--       abandono, Fase 4). Un registro por (hotel, email); se upserta con la
--       búsqueda más reciente. Solo lo toca el service-role (RLS sin políticas).
create table if not exists public.booking_intents (
  id                       uuid primary key default gen_random_uuid(),
  hotel_id                 uuid not null references public.hoteles(id) on delete cascade,
  email                    text not null,
  nombre                   text,
  payload                  jsonb not null default '{}'::jsonb, -- fechas, carrito, addons, lang…
  lang                     text,
  convertido               boolean not null default false,     -- ya reservó (el webhook lo marca)
  recordatorio_enviado_at  timestamptz,                        -- lo marca el cron de abandono (Fase 4)
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (hotel_id, email)
);

create index if not exists booking_intents_pendientes_idx
  on public.booking_intents (updated_at)
  where convertido = false and recordatorio_enviado_at is null;

alter table public.booking_intents enable row level security;

-- Listo. Motor Fase 2 aplicada.
