-- ═══════════════════════════════════════════════════════════════════════════
--  CANALES POR iCAL — Airbnb, Expedia (Vrbo) y «otro calendario».
--
--  POR QUÉ: la pestaña de canales vuelve al panel (lib/panel/canales-ota.ts),
--  ahora por UNIDAD física y con lectura cada 15 min. El CHECK de
--  `ota_channels.tipo` sólo aceptaba 'booking_com' y 'expedia': sin esto,
--  guardar un canal de Airbnb revienta en la base.
--
--  QUÉ AÑADE:
--    · `tipo` admite además 'airbnb', 'vrbo' y 'otro'.
--    · columna `etiqueta` (nombre libre para «otro calendario»).
--  `room_name` no cambia de tipo: desde hoy guarda el nombre de la UNIDAD
--  ("Cabaña 2"). Las filas viejas siguen valiendo — la 1ª unidad de cada tipo
--  se llama igual que el tipo.
--
--  MIENTRAS NO SE CORRA: Booking y Expedia siguen funcionando como antes; sólo
--  fallan al guardar los canales de Airbnb, Vrbo y «otro».
--
--  Es idempotente: correrlo dos veces no cambia nada.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.ota_channels
  drop constraint if exists ota_channels_tipo_check;

alter table public.ota_channels
  add constraint ota_channels_tipo_check
  check (tipo in ('booking_com', 'expedia', 'airbnb', 'vrbo', 'otro'));

alter table public.ota_channels
  add column if not exists etiqueta text;

comment on column public.ota_channels.room_name is
  'Nombre de la UNIDAD física enlazada (p. ej. "Cabaña 2"), igual que blocks.habitacion.';
comment on column public.ota_channels.etiqueta is
  'Nombre libre del calendario cuando tipo = ''otro'' (p. ej. "Google Calendar").';

-- Lectura por hotel en cada corrida del cron (cada 15 min).
create index if not exists ota_channels_activos_idx
  on public.ota_channels (hotel_id) where active;
