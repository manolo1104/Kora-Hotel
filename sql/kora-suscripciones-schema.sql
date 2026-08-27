-- ============================================================
--  Kora · Suscripciones (Stripe) — Esquema de base de datos (Supabase)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
--  (1 fila por usuario. El dueño solo puede LEER su suscripción; las
--   escrituras llegan únicamente del webhook de Stripe con la service-role key.)
-- ============================================================

create table if not exists public.suscripciones (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  -- 'kora' es el ÚNICO plan vivo (lib/oferta.ts). Los tres viejos se conservan
  -- para no invalidar filas históricas. Antes faltaba 'kora' aquí y la base
  -- rechazaba toda alta de suscripción: el hotelero pagaba y no recibía nada.
  -- 'kora' es el ÚNICO plan que existe (lib/oferta.ts). Los tres viejos
  -- (boutique/hotel/grande) se retiraron: ninguna parte del producto sabe
  -- interpretarlos y rompen el MRR del digest. Ver sql/kora-plan-unico.sql.
  plan                   text check (plan is null or plan = 'kora'),
  estado                 text not null default 'incompleta'
                           check (estado in ('activa','pago_vencido','cancelada','incompleta','cortesia')),
  periodo_fin            timestamptz,          -- fin del periodo pagado actual
  cancela_al_final       boolean not null default false,
  avisos_dunning         int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists susc_estado_idx on public.suscripciones (estado);

-- updated_at automático (reusa la función del CRM; si no existe, se crea)
create or replace function public.crm_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists susc_touch on public.suscripciones;
create trigger susc_touch before update on public.suscripciones
  for each row execute function public.crm_touch_updated_at();

-- RLS: el dueño solo LEE su fila; escrituras solo con service-role (webhook)
alter table public.suscripciones enable row level security;
drop policy if exists "suscripcion leer propia" on public.suscripciones;
create policy "suscripcion leer propia"
  on public.suscripciones for select using (auth.uid() = user_id);

-- Para dar de alta un hotel fundador en cortesía (sin Stripe), corre:
-- insert into public.suscripciones (user_id, plan, estado)
-- values ('<uuid del usuario en auth.users>', 'kora', 'cortesia');
