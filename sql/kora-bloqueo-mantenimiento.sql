-- ═══════════════════════════════════════════════════════════════════════════
--  BLOQUEAR UN CUARTO POR MANTENIMIENTO — el motivo, por escrito.
--
--  POR QUÉ: hoy, para cerrar una cabaña con una gotera, el hotelero crea una
--  RESERVA FALSA. Eso ensucia la ocupación, el ADR y el CRM, y a los tres meses
--  nadie recuerda si esa "reserva" fue un huésped o una fuga de agua.
--
--  LA MITAD YA ESTABA HECHA, y esa es la buena noticia: `blocks.status` ya
--  admite 'MANTENIMIENTO' en su CHECK desde `kora-multitenant-fase0.sql`, y las
--  once superficies que leen disponibilidad —el motor, la caja, Camila, el
--  calendario del panel, la reserva manual— ya lo respetan sin tocar una línea.
--  Lo único que faltaba era la puerta para escribirlo y un sitio donde decir
--  POR QUÉ está cerrado.
--
--  QUÉ AÑADE: una columna `motivo`. Nada más. No hay tabla nueva, no hay índice
--  nuevo, no cambia ningún CHECK ni ninguna policy.
--
--  MIENTRAS NO SE CORRA: el código sigue funcionando. `blockDates` detecta que
--  la columna no existe, reintenta sin ella y lo deja dicho en el log — el
--  bloqueo se guarda igual, sólo que sin motivo. Es el mismo patrón que
--  `recortar_bloqueo` en `kora-e3-apartado-atomico.sql`.
--
--  Es idempotente (`if not exists`): correrlo ES la comprobación.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.blocks
  add column if not exists motivo text;

comment on column public.blocks.motivo is
  'Por qué está cerrada esta unidad. Lo escribe el hotelero al bloquear desde el calendario (p. ej. "gotera en el techo"). Sólo tiene sentido con status BLOQUEADO o MANTENIMIENTO; en RESERVADO, HOLD y OTA va nulo.';

-- Comprobación (debe devolver una fila con data_type = 'text'):
--   select column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'blocks' and column_name = 'motivo';
