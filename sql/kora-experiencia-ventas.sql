-- ============================================================
--  Kora · Ventas de experiencias (cupo por día) — Esquema (Supabase)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
--
--  Registra los lugares vendidos de cada experiencia por día (Sprint 3 del
--  empaquetado). Lo escribe el webhook al confirmarse la reserva y lo borran
--  las cancelaciones; el checkout y el motor lo leen para respetar el cupo
--  diario que el hotelero define ("mi lancha lleva 8 personas").
--
--  La experiencia se identifica por NOMBRE (igual que las habitaciones en
--  blocks). El código es FAIL-SAFE: sin esta tabla, todo sigue funcionando
--  (simplemente no se aplica cupo y se registra el error en logs).
--
--  RLS ON sin políticas: solo el servidor escribe/lee, con la service-role
--  key y filtro explícito por hotel_id (mismo patrón que el resto).
-- ============================================================

create table if not exists public.experiencia_ventas (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hoteles(id) on delete cascade,
  confirmacion text not null,          -- folio de la reserva que consumió los lugares
  experiencia  text not null,          -- nombre de la experiencia (identidad, como en blocks)
  fecha        date not null,          -- día elegido por el huésped
  qty          integer not null default 1, -- lugares consumidos (boletos / personas / 1)
  created_at   timestamptz not null default now()
);

create index if not exists experiencia_ventas_cupo_idx
  on public.experiencia_ventas (hotel_id, experiencia, fecha);

create index if not exists experiencia_ventas_folio_idx
  on public.experiencia_ventas (hotel_id, confirmacion);

alter table public.experiencia_ventas enable row level security;
