-- ═══════════════════════════════════════════════════════════════════════════
-- Qué pestañas ve cada persona del equipo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- MANOLO: este archivo es IDEMPOTENTE (`if not exists`). Correrlo ES la
-- comprobación: si ya estaba aplicado, no hace nada y no rompe nada. Se pega
-- entero en el editor SQL de Supabase y se ejecuta.
--
-- QUÉ HACE: agrega UNA columna a `hotel_members`. Nada más. No borra, no
-- actualiza filas, no toca permisos ni políticas.
--
-- POR QUÉ: hasta ahora el puesto decidía las dos cosas a la vez — qué puede
-- hacer alguien y qué pestañas ve—. El hotel de Nealtican dio de alta a su
-- camarista con el puesto "Limpieza" y ésta veía la pestaña de Reservas con el
-- total de cada noche. Con esta columna el dueño puede esconderle pestañas
-- una por una sin cambiarle el puesto.
--
-- CÓMO SE LEE:
--   pantallas = null            → ve TODAS las de su puesto (lo de siempre).
--   pantallas = '{operaciones}' → de las de su puesto, sólo ésa.
--
-- El valor por defecto es NULL a propósito: las filas que ya existen se quedan
-- exactamente como estaban y nadie pierde acceso al aplicar esto.
--
-- Las casillas SÓLO QUITAN. Un array aquí nunca da una pantalla que el puesto
-- no incluya: quien decide el techo sigue siendo `rol` + lib/panel/permisos.ts.
-- Por eso esta columna no necesita CHECK contra la lista de pantallas: el
-- servidor la sanea al guardar (lib/panel/pantallas.ts → sanearPantallas) y al
-- leer descarta cualquier id que no reconozca.

alter table public.hotel_members
  add column if not exists pantallas text[];

comment on column public.hotel_members.pantallas is
  'Pestañas del panel que ve esta persona. NULL = todas las de su rol. Nunca amplía el rol: sólo quita.';
