-- Check-in real de una reserva: que recepción pueda AFIRMAR que el huésped llegó.
--
-- POR QUÉ: Kora tenía check-out (`checkout_real`) pero no tenía check-in. La
-- llegada se DEDUCÍA de las fechas, nunca se afirmaba, y eso rompía dos casos
-- que el hotelero ve todos los días:
--
--   1. La estancia de UNA noche nunca aparecía "En casa". El estado de la lista
--      exige `checkin < hoy` estricto, así que una reserva que entra hoy y sale
--      mañana pasa de "Check-in hoy" a "Check-out hoy" y nunca por "En casa".
--      Lo reportó el Hotel Nealtican: "esta información aparece principalmente
--      cuando el huésped tiene una estancia de varios días".
--   2. No se podía distinguir "llega hoy" de "ya está aquí", que es justo lo que
--      recepción necesita saber de un vistazo.
--
-- Misma decisión que en `kora-checkout-real.sql`: columna NUEVA y ANULABLE en
-- vez de tocar el CHECK de `bookings.estado` (que sólo admite
-- CONFIRMADA/CANCELADA/MANUAL/REEMBOLSADA). Así la migración no puede romper
-- ninguna fila existente ni ningún webhook.
--
-- NULL  = no ha llegado (o el hotel no usa el botón: todo sigue como antes).
-- Fecha = llegó a esa hora; el cuarto está ocupado desde ese momento SIN mirar
--         las fechas de la reserva. Eso es lo que hace posible el walk-in y el
--         huésped que se queda de más.
--
-- Es idempotente (`if not exists`), así que correrlo ES la comprobación: no hace
-- falta consultar antes ni decidir después.

alter table public.bookings
  add column if not exists checkin_real timestamptz;

comment on column public.bookings.checkin_real is
  'Cuándo llegó de verdad el huésped. NULL = no ha llegado. Ocupa el cuarto sin esperar a la fecha de entrada.';

-- El mapa de cuartos recorre esta columna en cada carga (y se recarga cada 30 s)
-- buscando a los que están dentro: llegaron y no se han ido.
create index if not exists bookings_checkin_real_dentro_idx
  on public.bookings (hotel_id, checkin_real)
  where checkin_real is not null and checkout_real is null;
