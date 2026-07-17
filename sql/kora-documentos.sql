-- Documentos branded (cotización / reserva) — guarda las ediciones del editor
-- "modificar antes de descargar" sin ensuciar el campo `notas`.
--
-- La columna `doc` (jsonb) guarda SOLO los campos que el hotelero sobreescribió
-- en el editor (vigencia, método/fecha de pago, nota, conceptos, montos, etc.).
-- El resto se recalcula al vuelo desde el registro + las reglas del hotel.
--
-- Correr una vez en Supabase (SQL editor). Es idempotente.

alter table public.quotes   add column if not exists doc jsonb not null default '{}'::jsonb;
alter table public.bookings add column if not exists doc jsonb not null default '{}'::jsonb;
