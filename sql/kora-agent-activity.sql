-- ============================================================
--  Kora · Actividad de los agentes IA — Esquema (Supabase)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
--
--  Registra lo que los agentes hacen por cada hotel: consultas del bot de
--  WhatsApp (/api/agent), correos automáticos del ciclo de estancia (cron
--  email-sequences), etc. Alimenta las métricas de "Agentes" en Insights
--  (hoy siempre en 0) y el contexto del asistente IA del panel.
--
--  El código es FAIL-SAFE: mientras esta tabla no exista, todo sigue
--  funcionando igual (solo se registra el error en logs y las métricas
--  siguen en 0). Correr este SQL las enciende.
--
--  RLS ON sin políticas: solo el servidor escribe/lee, con la service-role
--  key y filtro explícito por hotel_id (mismo patrón que el resto).
-- ============================================================

create table if not exists public.agent_activity (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  tipo       text not null,           -- whatsapp_conv | email_confirmacion | email_preestancia | email_postestancia | blog_publicado | cotizacion_auto_enviada
  fecha      date not null,           -- día en zona America/Mexico_City (lo pone el servidor)
  detalle    text not null default '',-- p.ej. "conv:5214891234567", "post_day7:PE-2026-ABCD"
  created_at timestamptz not null default now()
);

create index if not exists agent_activity_hotel_fecha_idx
  on public.agent_activity (hotel_id, fecha desc);

alter table public.agent_activity enable row level security;
