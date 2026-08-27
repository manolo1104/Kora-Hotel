-- ═══════════════════════════════════════════════════════════════════════════
-- MOTOR · FASE 4 — que el motor deje de reembolsar reservas pagadas y válidas
-- Etapa 2 (el dinero), paso 2.5 del PLAN_ARREGLO_KORA. Cierra K-03, K-47, K-59.
--
-- QUÉ ESTABA MAL. Dos defectos distintos con el mismo final: el huésped paga
-- bien, el motor concluye que el cuarto está ocupado, le devuelve el dinero y le
-- manda un correo diciéndole que se quedó sin habitación.
--
--   (a) K-59 — LA IDEMPOTENCIA CORRÍA ANTES DEL CANDADO. Medido en producción
--       el 26 ago 2026 sobre la función instalada: la comprobación de
--       `payment_intent_id` estaba en la posición 533 del cuerpo y
--       `pg_advisory_xact_lock` en la 747. Dos entregas simultáneas del MISMO
--       evento de Stripe (que Stripe reintenta) leían las dos "no existe", se
--       serializaban en el candado, y la segunda chocaba contra los `blocks`
--       que acababa de crear la primera → `CUARTO_NO_DISPONIBLE` sobre una
--       reserva que SÍ existía.
--
--   (b) K-03/K-47 — EL APARTADO PROPIO SE CONTABA COMO OCUPACIÓN AJENA. El
--       webhook borraba el hold ANTES de llamar al RPC para que no estorbara.
--       Si ese borrado fallaba —basta un timeout de Supabase— el RPC veía el
--       hold del propio huésped y lo trataba como cuarto vendido. Seis
--       auditores llegaron por separado a este defecto; es el más corroborado
--       del informe.
--
-- QUÉ CAMBIA. Sólo dos cosas, y ninguna toca la lógica anti-sobreventa:
--   1. El candado sube al principio. La idempotencia queda DEBAJO.
--   2. Parámetro nuevo `p_hold_session text default null`. Cuando viene, las
--      dos comprobaciones de solape ignoran los bloqueos de ESA sesión — los
--      del propio huésped que está pagando. Con `null` el comportamiento es
--      byte-idéntico a la fase 3 (mismo truco que usó fase 3 con `p_asignacion`).
--
-- LO QUE NO CAMBIA, A PROPÓSITO: sigue devolviendo `uuid`. El plan proponía
-- `returns table(id, confirmacion)` para que el llamador conozca el folio REAL
-- cuando la idempotencia devuelve una reserva preexistente, pero cambiar el tipo
-- de retorno rompe el código que ya está desplegado en el instante en que se
-- corre este SQL, y en este proyecto el SQL lo corre una persona en el navegador
-- mientras Vercel despliega por su cuenta: esa ventana es real. El folio real lo
-- resuelve el llamador con una lectura por clave primaria (`lib/db/bookings.ts`),
-- que cuesta nada y cierra K-105/K-106 igual de bien.
--
-- POR QUÉ HAY UN `drop` ANTES. Añadir un parámetro NO reemplaza la función: crea
-- una segunda con distinta aridad. Como el código llama con parámetros NOMBRADOS,
-- tener las dos haría la llamada ambigua ("function is not unique") y se caerían
-- TODAS las reservas. El editor SQL de Supabase corre el script en una
-- transacción, así que entre el `drop` y el `create` no hay ventana.
--
-- CÓMO REVERTIR: volver a correr `sql/kora-motor-fase3.sql` entero. Verificado
-- el 26 ago 2026 que ese archivo es byte a byte lo que estaba instalado
-- (md5 del cuerpo `a41a6ef330786927ed8b6bc5b3769a75`, 3368 caracteres).
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.crear_reserva_atomica(
  uuid, text[], date, date, text, text, text, text, numeric, numeric,
  integer, text, text, text, text, text, text, jsonb
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
  p_asignacion        jsonb  default null,    -- reserva por tipo+cantidad (fase 3)
  p_hold_session      text   default null     -- NUEVO: el apartado propio no estorba
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
  -- 1) Serializa TODA la creación de reservas de este hotel (anti-sobreventa).
  --    VA PRIMERO. En la fase 3 iba después de la idempotencia, y ése era K-59.
  perform pg_advisory_xact_lock(hashtext(p_hotel_id::text));

  -- 2) Idempotencia por pago, YA BAJO EL CANDADO: si ya existe reserva para
  --    este payment_intent, devolverla SIN reasignar (un reintento de webhook
  --    no duplica ni realoca). Con el candado arriba, la segunda entrega
  --    simultánea espera aquí y encuentra la reserva de la primera.
  if p_payment_intent_id is not null then
    select id into v_existing from public.bookings
     where hotel_id = p_hotel_id and payment_intent_id = p_payment_intent_id;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

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
           -- El apartado del propio huésped que está pagando no es ocupación.
           and (p_hold_session is null or b.hold_session is distinct from p_hold_session)
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
             and (p_hold_session is null or b.hold_session is distinct from p_hold_session)
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
-- COMPROBACIÓN (correr después, en el mismo editor)
-- ═══════════════════════════════════════════════════════════════════════════
-- Las dos tienen que salir en true:
--
-- select position('pg_advisory_xact_lock' in prosrc)
--        < position('payment_intent_id = p_payment_intent_id' in prosrc) as candado_primero,
--        position('p_hold_session' in prosrc) > 0 as tiene_hold_session
--   from pg_proc where proname = 'crear_reserva_atomica';
