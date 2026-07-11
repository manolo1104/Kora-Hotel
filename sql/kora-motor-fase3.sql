-- ═══════════════════════════════════════════════════════════════════════════
-- KORA · MOTOR FASE 3 — Reserva por TIPO + CANTIDAD con asignación de unidades
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  NO APLICADA TODAVÍA. Este archivo habilita la Fase 2 del código (motor
--     "reservar N unidades de un tipo"). Antes de correrla en PRODUCCIÓN:
--       1) Aplicar y PROBAR en un proyecto/branch de Supabase de STAGING.
--       2) Probar los 3 escenarios de la sección "VERIFICACIÓN" al final.
--       3) Solo entonces aplicar en prod, y después desplegar el código de Fase 2.
--     El wrapper TS `createBookingAtomic` reintenta sin `p_asignacion` si la BD
--     aún no tiene esta firma, así que el código tolera cualquier estado de la BD.
--
-- Idempotente: `drop function ... if exists` + `create or replace`. Re-ejecutable.
-- Pegar DESPUÉS de fase0/fase1/fase2 en el editor SQL de Supabase.
--
-- QUÉ CAMBIA vs. fase2:
--   • Añade el parámetro final `p_asignacion jsonb default null`.
--   • Cuando `p_asignacion IS NULL` → comportamiento BYTE-IDÉNTICO a fase2
--     (camino legacy: nombres de unidad explícitos, 1 block por nombre).
--   • Cuando viene `p_asignacion` (lista de tipos con cantidad y unidades
--     candidatas) → ASIGNA las primeras unidades LIBRES de cada tipo DENTRO del
--     `pg_advisory_xact_lock` (libre de carreras) y crea 1 block por unidad.
--   • El anti-sobreventa se mantiene: cada unidad sigue siendo un nombre único en
--     `blocks`; el lock por-hotel serializa toda la creación de reservas.
--
-- Formato de p_asignacion (jsonb):
--   [ { "tipo": "Suite Jungla", "cantidad": 2,
--       "unidades": ["Suite Jungla", "Suite Jungla 2", "Suite Jungla 3"] }, ... ]
--   (el llamador manda TODAS las unidades candidatas del tipo; la RPC elige las
--    primeras `cantidad` que estén libres para las fechas.)
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.crear_reserva_atomica(
  uuid, text[], date, date, text, text, text, text, numeric, numeric, int,
  text, text, text, text, text, text
);

create or replace function public.crear_reserva_atomica(
  p_hotel_id          uuid,
  p_habitaciones      text[],                 -- LEGACY: nombres de unidad (cantidad=1)
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
  p_rate_plan         text   default null,
  p_asignacion        jsonb  default null     -- NUEVO: reserva por tipo+cantidad
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
  v_linea      jsonb;
  v_cantidad   int;
  v_unidad     text;
  v_asignadas  text[] := '{}';   -- unidades finalmente asignadas (blocks + CSV)
  v_libres     int;
begin
  -- 1) Idempotencia por pago: si ya existe reserva para este payment_intent,
  --    devolverla SIN reasignar (un reintento de webhook no duplica ni realoca).
  if p_payment_intent_id is not null then
    select id into v_existing from public.bookings
     where hotel_id = p_hotel_id and payment_intent_id = p_payment_intent_id;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  -- 2) Serializa TODA la creación de reservas de este hotel (anti-sobreventa).
  perform pg_advisory_xact_lock(hashtext(p_hotel_id::text));

  if p_asignacion is null then
    -- ── CAMINO LEGACY (idéntico a fase2): unidades explícitas, 1 por nombre ──
    foreach v_room in array p_habitaciones loop
      if exists (
        select 1 from public.blocks b
         where b.hotel_id = p_hotel_id
           and b.habitacion = v_room
           and b.checkin < p_checkout
           and p_checkin < b.checkout
           and (b.expires_at is null or b.expires_at > now())
      ) then
        raise exception 'CUARTO_NO_DISPONIBLE: %', v_room using errcode = 'check_violation';
      end if;
    end loop;
    v_asignadas := p_habitaciones;
  else
    -- ── CAMINO POR TIPO+CANTIDAD: asignar unidades libres bajo el lock ──
    for v_linea in select * from jsonb_array_elements(p_asignacion) loop
      v_cantidad := coalesce((v_linea->>'cantidad')::int, 0);
      v_libres := 0;
      for v_unidad in select jsonb_array_elements_text(v_linea->'unidades') loop
        exit when v_libres >= v_cantidad;
        if not exists (
          select 1 from public.blocks b
           where b.hotel_id = p_hotel_id
             and b.habitacion = v_unidad
             and b.checkin < p_checkout
             and p_checkin < b.checkout
             and (b.expires_at is null or b.expires_at > now())
        ) then
          v_asignadas := array_append(v_asignadas, v_unidad);
          v_libres := v_libres + 1;
        end if;
      end loop;
      if v_libres < v_cantidad then
        raise exception 'CUARTO_NO_DISPONIBLE: %', (v_linea->>'tipo')
          using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  -- 3) Inserta la reserva (habitaciones = CSV de unidades asignadas, como hoy).
  insert into public.bookings (
    hotel_id, confirmacion, cliente, telefono, email, checkin, checkout,
    noches, huespedes, habitaciones, total, anticipo, payment_intent_id,
    estado, origen, como_nos_conocio, notas, rate_plan
  ) values (
    p_hotel_id, p_confirmacion, p_cliente, p_telefono, p_email, p_checkin, p_checkout,
    (p_checkout - p_checkin), p_huespedes, array_to_string(v_asignadas, ', '),
    p_total, p_anticipo, p_payment_intent_id,
    p_estado, p_origen, p_como_nos_conocio, p_notas, p_rate_plan
  )
  returning id into v_booking_id;

  -- 4) Un block 'RESERVADO' por unidad asignada (fuente de verdad de ocupación).
  foreach v_room in array v_asignadas loop
    insert into public.blocks (hotel_id, habitacion, checkin, checkout, status, booking_id)
    values (p_hotel_id, v_room, p_checkin, p_checkout, 'RESERVADO', v_booking_id);
  end loop;

  return v_booking_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN EN STAGING (correr a mano; NO en prod la primera vez)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Compatibilidad legacy: llamar con p_asignacion = null y comparar que
--    crea la reserva + blocks idénticos a fase2 para las mismas entradas.
-- 2) Concurrencia: en dos transacciones solapadas, pedir la ÚLTIMA unidad libre
--    de un tipo (misma fecha) → exactamente UNA debe tener éxito y la otra
--    lanzar 'CUARTO_NO_DISPONIBLE'. (El advisory lock lo garantiza.)
-- 3) Idempotencia: llamar dos veces con el mismo p_payment_intent_id → mismo
--    booking id, sin doble asignación ni blocks duplicados.
-- ═══════════════════════════════════════════════════════════════════════════
