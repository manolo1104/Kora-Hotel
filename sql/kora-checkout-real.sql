-- Check-out real de una reserva.
--
-- POR QUÉ: un hotelero probando Kora registró una reserva, vio el cuarto en
-- "Ocupada" y NO encontró forma de hacerle check-out. No la encontró porque no
-- existía: la ocupación se derivaba SÓLO de las fechas
-- (`checkin <= hoy AND checkout > hoy`), así que el cuarto seguía ocupado hasta
-- que la fecha de salida pasaba sola. Cambiar el estado a mano en el mapa de
-- cuartos tampoco servía: la ocupación derivada lo volvía a pisar.
--
-- Se añade una columna NUEVA y ANULABLE en vez de tocar el CHECK de
-- `bookings.estado` (que sólo admite CONFIRMADA/CANCELADA/MANUAL/REEMBOLSADA):
-- así la migración no puede romper ninguna fila existente ni ningún webhook.
--
-- NULL  = el huésped no ha salido (comportamiento de siempre).
-- Fecha = salió a esa hora; el cuarto queda libre desde ese momento.

alter table public.bookings
  add column if not exists checkout_real timestamptz;

comment on column public.bookings.checkout_real is
  'Cuándo salió de verdad el huésped. NULL = sigue en casa. Libera el cuarto sin esperar a la fecha de salida.';

-- Las consultas de ocupación filtran por esta columna en cada carga del mapa de
-- cuartos, así que conviene el índice parcial (sólo las que siguen en casa).
create index if not exists bookings_checkout_real_null_idx
  on public.bookings (hotel_id, checkin, checkout)
  where checkout_real is null;
