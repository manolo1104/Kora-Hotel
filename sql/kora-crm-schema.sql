-- ============================================================
--  Kora · CRM de ventas — Esquema de base de datos (Supabase)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
--  (Es un CRM PRIVADO de Manolo. Las tablas tienen RLS SIN políticas públicas:
--   solo se acceden desde el servidor con la service-role key.)
-- ============================================================

-- 1) Leads (un prospecto = un hotel)
create table if not exists public.crm_leads (
  id                  uuid primary key default gen_random_uuid(),
  hotel_nombre        text not null,
  tomador_nombre      text,
  tomador_puesto      text,
  contacto            text,            -- teléfono / WhatsApp
  email               text,
  ciudad              text,
  origen              text,            -- Instagram, Google Ads, referido, etc.
  etapa               text not null default 'nuevo'
                        check (etapa in ('nuevo','contactado','propuesta','negociacion','ganado','perdido')),
  valor_estimado      numeric,         -- MXN
  proximo_seguimiento date,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 2) Actividades (registro de acciones / llamadas por lead)
create table if not exists public.crm_actividades (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.crm_leads(id) on delete cascade,
  tipo        text not null default 'nota'
                check (tipo in ('llamada','correo','whatsapp','reunion','nota')),
  nota        text,
  fecha       date not null default current_date,
  created_at  timestamptz not null default now()
);

-- 3) Índices
create index if not exists crm_leads_etapa_idx        on public.crm_leads (etapa);
create index if not exists crm_leads_seguimiento_idx  on public.crm_leads (proximo_seguimiento);
create index if not exists crm_act_lead_idx           on public.crm_actividades (lead_id);

-- 4) updated_at automático en crm_leads
create or replace function public.crm_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists crm_leads_touch on public.crm_leads;
create trigger crm_leads_touch
  before update on public.crm_leads
  for each row execute function public.crm_touch_updated_at();

-- 5) RLS ON, SIN políticas → nadie con la anon key puede leer/escribir.
--    El acceso es solo desde el servidor de Kora con la service-role key.
alter table public.crm_leads      enable row level security;
alter table public.crm_actividades enable row level security;

-- Listo. El CRM ya puede usar estas tablas desde /crm (con SUPABASE_SERVICE_ROLE_KEY).
