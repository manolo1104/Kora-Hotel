-- ─────────────────────────────────────────────────────────────────────────────
-- Kora · Correos unificados y seguimiento de leads
--
-- Correr en el SQL Editor de Supabase (producción). ES IDEMPOTENTE: todo lleva
-- `if not exists`, así que correrlo de nuevo no hace nada donde ya está aplicado
-- y REPARA lo que falte. Por eso no hace falta comprobar antes si ya se corrió:
-- correrlo ES la comprobación. No borra ni modifica ninguna fila existente.
--
-- Qué habilita:
--   1. bookings.lang  → las secuencias pre/post estancia salen en el idioma con
--      el que reservó el huésped (antes todo iba en español, incluso a quien
--      reservó en inglés).
--   2. crm_leads.email + crm_leads.secuencia_pausada → seguimiento por correo a
--      los leads del sitio (antes el formulario no pedía correo).
--   3. lead_email_log → dedup de la secuencia de leads, igual que email_log
--      hace con los correos del huésped.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Idioma de la reserva ────────────────────────────────────────────────────
alter table public.bookings
  add column if not exists lang text;

comment on column public.bookings.lang is
  'Idioma con el que reservó el huésped ("es" | "en"). NULL = es.';

-- 2. Correo del lead + apagador de la secuencia ─────────────────────────────
alter table public.crm_leads
  add column if not exists email text;

alter table public.crm_leads
  add column if not exists secuencia_pausada boolean not null default false;

comment on column public.crm_leads.email is
  'Correo del hotelero interesado. Sin él no se le puede dar seguimiento por correo.';
comment on column public.crm_leads.secuencia_pausada is
  'true = ya se contactó a mano o pidió no recibir más; la secuencia no le escribe.';

-- 3. Dedup de la secuencia de leads ──────────────────────────────────────────
create table if not exists public.lead_email_log (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references public.crm_leads (id) on delete cascade,
  email_type    text not null,
  email_destino text,
  resend_id     text,
  created_at    timestamptz not null default now(),
  unique (lead_id, email_type)
);

create index if not exists lead_email_log_lead_idx on public.lead_email_log (lead_id);

-- Solo el service-role (los crons y las rutas de servidor) toca esta tabla.
--
-- HACEN FALTA LAS DOS CAPAS, no sólo RLS. Supabase le da GRANT a `anon` y
-- `authenticated` en toda tabla nueva de `public`, y esta guarda correos de
-- personas (`email_destino`). RLS sin políticas ya filtra todas las filas, pero
-- el revoke es la segunda cerradura y es gratis. Mismo patrón que
-- `hotel_bot_tokens` (kora-bot-tokens-paso1.sql).
alter table public.lead_email_log enable row level security;
revoke all on public.lead_email_log from anon, authenticated;

-- ── COMPROBACIÓN ────────────────────────────────────────────────────────────
-- Si esta consulta devuelve 1, 2, 1 y false, quedó todo aplicado.
select
  (select count(*) from information_schema.columns
     where table_name = 'bookings' and column_name = 'lang')                       as bookings_lang,
  (select count(*) from information_schema.columns
     where table_name = 'crm_leads'
       and column_name in ('email', 'secuencia_pausada'))                          as columnas_lead,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'lead_email_log')              as tabla_log,
  has_table_privilege('anon', 'public.lead_email_log', 'SELECT')                    as anon_puede_leer;
