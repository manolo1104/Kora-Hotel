-- ═══════════════════════════════════════════════════════════════════════════
--  LA POLÍTICA QUE EL HUÉSPED ACEPTÓ, GUARDADA CON SU RESERVA.
--
--  POR QUÉ: hoy `bookings` guarda `rate_plan` ('flex' | 'nrf') y nada más. La
--  política se vuelve a calcular con la configuración de HOY cada vez que
--  alguien mira una reserva. Es decir: el día que el hotelero cambia
--  «cancelación gratis hasta 7 días» por «hasta 2», cambia RETROACTIVAMENTE las
--  condiciones de reservas que ya estaban pagadas y aceptadas.
--
--  El checkout ya exige `aceptaPolitica: true` para dejar reservar —el huésped
--  marca una casilla— pero NO se guardaba qué había aceptado. Si reclama, no
--  hay forma de saber quién tiene razón. Con esta columna, sí.
--
--  QUÉ AÑADE: una columna jsonb. Ni tabla nueva, ni índice, ni CHECK, ni policy.
--
--  QUÉ GUARDA: `{"escalones":[{"diasAntes":7,"reembolsoPct":100}],"noShowPct":0}`
--  — la estructura, no el texto. El texto se deriva de ella, así que una reserva
--  vieja se puede volver a redactar en español o en inglés sin perder nada.
--
--  MIENTRAS NO SE CORRA: el código sigue funcionando exactamente como hoy. Al
--  guardar detecta que la columna no existe, reintenta sin ella y lo deja dicho
--  en el log; al leer, una reserva sin copia usa la política actual del hotel,
--  que es el comportamiento de siempre. No hay ventana rota.
--
--  Es idempotente (`if not exists`): correrlo ES la comprobación.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.bookings
  add column if not exists politica_snapshot jsonb;

comment on column public.bookings.politica_snapshot is
  'La política de cancelación que el huésped ACEPTÓ al reservar, en estructura (escalones + noShowPct). Se escribe una vez, al crear la reserva, y no se toca después: es lo que decide el reembolso si cancela. Nulo en reservas anteriores al 2 sep 2026, que caen a la política vigente del hotel.';

-- Comprobación (debe devolver una fila con data_type = 'jsonb'):
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'bookings'
--      and column_name = 'politica_snapshot';
