-- ============================================================
--  Kora · Chat de soporte — Esquema de base de datos (Supabase)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
--  (Guarda las conversaciones del chat para revisarlas y mejorar el bot.
--   RLS ON sin políticas: solo el servidor escribe, con la service-role key.)
-- ============================================================

create table if not exists public.soporte_conversaciones (
  id          uuid primary key default gen_random_uuid(),
  session_id  text not null unique,  -- id anónimo generado por el widget
  pagina      text,                  -- ruta donde inició la conversación
  mensajes    jsonb not null default '[]'::jsonb,  -- [{rol, texto, ts}]
  escalado    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists soporte_creado_idx on public.soporte_conversaciones (created_at);

drop trigger if exists soporte_touch on public.soporte_conversaciones;
create trigger soporte_touch before update on public.soporte_conversaciones
  for each row execute function public.crm_touch_updated_at();

alter table public.soporte_conversaciones enable row level security;
