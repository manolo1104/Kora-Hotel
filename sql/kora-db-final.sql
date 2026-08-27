-- ============================================================
--  Kora · Plataforma multi-tenant — Cierre de base de datos
--  Corre esto en Supabase → SQL Editor → New query → Run.
--  Aditivo e idempotente. Reúne lo que falta tras las Fases 0–5:
--   (A) columna hold_session (holds de carrito del motor público)
--   (B) tabla suscripciones (no existía en este proyecto) + hotel_id
--  Requisito: la Fase 0 (kora-multitenant-fase0.sql) ya debe estar aplicada.
-- ============================================================

-- ── (A) Holds de carrito ─────────────────────────────────────────────────────
alter table public.blocks
  add column if not exists hold_session text;

create index if not exists blocks_hold_session_idx
  on public.blocks (hotel_id, hold_session) where hold_session is not null;

create or replace function public.limpiar_holds_vencidos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.blocks
   where status = 'HOLD' and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── (B) Suscripciones (cobro de la plataforma a los hoteles) ─────────────────
create table if not exists public.suscripciones (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- 'kora' es el ÚNICO plan vivo (lib/oferta.ts). Los tres viejos se conservan
  -- para no invalidar filas históricas. Sin 'kora' aquí, la base rechaza toda
  -- alta de suscripción: el hotelero paga y no recibe nada.
  -- 'kora' es el ÚNICO plan que existe (lib/oferta.ts). Los tres viejos
  -- (boutique/hotel/grande) se retiraron: ninguna parte del producto sabe
  -- interpretarlos y rompen el MRR del digest. Ver sql/kora-plan-unico.sql.
  plan                   text check (plan is null or plan = 'kora'),
  estado                 text not null default 'incompleta'
                           check (estado in ('activa','pago_vencido','cancelada','incompleta','cortesia')),
  periodo_fin            timestamptz,
  cancela_al_final       boolean not null default false,
  avisos_dunning         int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Una suscripción por usuario (modelo actual del checkout de Kora). El cobro por
-- hotel se habilita con la columna hotel_id de abajo cuando se cablee el wizard.
create unique index if not exists suscripciones_user_uidx on public.suscripciones (user_id);
create index if not exists susc_estado_idx on public.suscripciones (estado);

-- hotel_id para cobro POR HOTEL (nullable; las filas account-level lo dejan NULL).
alter table public.suscripciones
  add column if not exists hotel_id uuid references public.hoteles(id) on delete cascade;
create unique index if not exists suscripciones_hotel_uidx
  on public.suscripciones (hotel_id) where hotel_id is not null;

-- updated_at automático (la función ya existe desde la Fase 0).
drop trigger if exists susc_touch on public.suscripciones;
create trigger susc_touch before update on public.suscripciones
  for each row execute function public.crm_touch_updated_at();

-- RLS: el dueño lee su suscripción; los miembros leen la del hotel (si hotel_id).
-- Las ESCRITURAS llegan solo del webhook de Stripe con service-role.
alter table public.suscripciones enable row level security;

drop policy if exists "suscripcion leer propia" on public.suscripciones;
create policy "suscripcion leer propia"
  on public.suscripciones for select using (auth.uid() = user_id);

drop policy if exists "suscripcion miembro leer" on public.suscripciones;
create policy "suscripcion miembro leer"
  on public.suscripciones for select
  using (hotel_id is not null and es_miembro_hotel(hotel_id));

-- Listo. Base de datos al día para Fases 0–5.
