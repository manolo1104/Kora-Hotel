-- ═══════════════════════════════════════════════════════════════════════════
-- KORA — Pagos FASE 3 (Stripe Connect: estado persistido + reembolsos)
-- Pegar en Supabase SQL Editor DESPUÉS de kora-motor-fase2.sql.
-- Idempotente: se puede correr más de una vez.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1) Estado de la cuenta Stripe Connect de cada hotel ──────────────────────
-- La escribe SOLO el servidor (webhook account.updated + refresh del panel).
-- Los miembros del hotel pueden leerla (para la card de Pagos).
create table if not exists public.hotel_stripe_accounts (
  hotel_id           uuid primary key references public.hoteles(id) on delete cascade,
  stripe_account_id  text not null unique,
  onboarding_status  text not null default 'pendiente'
                       check (onboarding_status in ('pendiente','verificado','requiere_info')),
  charges_enabled    boolean not null default false,
  payouts_enabled    boolean not null default false,
  oxxo_enabled       boolean not null default false,
  details_submitted  boolean not null default false,
  requirements_due   int not null default 0,
  updated_at         timestamptz not null default now()
);

alter table public.hotel_stripe_accounts enable row level security;

drop policy if exists hotel_stripe_accounts_select on public.hotel_stripe_accounts;
create policy hotel_stripe_accounts_select on public.hotel_stripe_accounts
  for select using (public.es_miembro_hotel(hotel_id));
-- (sin políticas de insert/update/delete: solo el service-role escribe)

-- ── 2) Reservas reembolsadas ─────────────────────────────────────────────────
-- El webhook charge.refunded marca la reserva y libera el inventario.
alter table public.bookings drop constraint if exists bookings_estado_check;
alter table public.bookings add constraint bookings_estado_check
  check (estado in ('CONFIRMADA','CANCELADA','MANUAL','REEMBOLSADA'));

-- Listo. Pagos Fase 3 aplicada.
