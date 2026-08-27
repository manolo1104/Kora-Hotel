-- ─────────────────────────────────────────────────────────────────────────────
-- Kora · Lista de correo (suscriptores de la guía)
--
-- Correr una sola vez en el SQL Editor de Supabase (producción). Es idempotente:
-- si lo corres dos veces no pasa nada.
--
-- POR QUÉ UNA TABLA APARTE Y NO `crm_leads`:
--   Un suscriptor no es un lead. Deja SOLO su correo a cambio de la guía; no
--   pidió que le hablen. Si cayera en `crm_leads` heredaría `proximo_seguimiento`
--   a 2 días y el digest diario reportaría decenas de "seguimientos vencidos"
--   que nadie va a atender — y el digest dejaría de leerse. El suscriptor sube a
--   lead cuando ÉL da el paso (usa una herramienta, pide demo): ahí sí entra por
--   /api/leads con su WhatsApp.
--
-- Qué crea:
--   1. suscriptores          → la lista, con su token de baja.
--   2. suscriptor_email_log  → dedup atómico de la secuencia (mismo patrón que
--                              lead_email_log: reclamar la fila ANTES de enviar).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. La lista ────────────────────────────────────────────────────────────────
create table if not exists public.suscriptores (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  nombre        text,
  -- De dónde entró: "popup", "footer", "blog:slug", "guia", "herramienta:slug".
  origen        text,
  -- Token de la baja de un clic. Va en la URL del pie de CADA correo.
  token_baja    uuid not null default gen_random_uuid(),
  -- NULL = activo. Con fecha = se dio de baja y no recibe NADA más.
  baja_at       timestamptz,
  -- Cómo se dio de baja ("link", "reporte", "manual"), para saber si hay que
  -- corregir algo en la secuencia.
  baja_motivo   text,
  created_at    timestamptz not null default now(),
  unique (email)
);

comment on table public.suscriptores is
  'Lista de correo de Kora (hoteleros que pidieron la guía). NO es el CRM: un suscriptor no pidió que le hablen.';
comment on column public.suscriptores.baja_at is
  'Con fecha = dado de baja. La secuencia lo salta para siempre; volver a suscribirse lo limpia.';
comment on column public.suscriptores.token_baja is
  'Secreto de la baja de un clic. Va en el pie de cada correo; no se regenera al reactivar (un link viejo debe seguir dando de baja).';

create index if not exists suscriptores_activos_idx
  on public.suscriptores (created_at) where baja_at is null;

create index if not exists suscriptores_token_idx
  on public.suscriptores (token_baja);

-- 2. Dedup de la secuencia ───────────────────────────────────────────────────
-- El UNIQUE es lo que hace imposible mandar dos veces el mismo toque: el cron
-- RECLAMA la fila (upsert ignoreDuplicates) antes de enviar. Si el envío falla,
-- la borra para reintentar mañana.
create table if not exists public.suscriptor_email_log (
  id            uuid primary key default gen_random_uuid(),
  suscriptor_id uuid not null references public.suscriptores (id) on delete cascade,
  email_type    text not null,
  email_destino text,
  resend_id     text,
  created_at    timestamptz not null default now(),
  unique (suscriptor_id, email_type)
);

create index if not exists suscriptor_email_log_sus_idx
  on public.suscriptor_email_log (suscriptor_id);

-- 3. Candado ─────────────────────────────────────────────────────────────────
-- Solo el service-role (las rutas de servidor y el cron) toca estas tablas.
-- Sin políticas, RLS activo = nadie más lee ni escribe, ni con la llave pública.
alter table public.suscriptores enable row level security;
alter table public.suscriptor_email_log enable row level security;

revoke all on public.suscriptores from anon, authenticated;
revoke all on public.suscriptor_email_log from anon, authenticated;
