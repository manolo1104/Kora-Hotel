-- ============================================================
--  Kora · Conversaciones de Camila (WhatsApp) — Esquema (Supabase)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
--
--  Guarda el TEXTO de las conversaciones entre los huéspedes y Camila (el bot
--  de WhatsApp), por hotel, para poder analizarlas después (qué preguntan, qué
--  objeciones, oportunidades de venta). Una fila por hilo (hotel + teléfono);
--  los mensajes se acumulan en `mensajes` (jsonb).
--
--  El código es FAIL-SAFE: mientras esta tabla no exista, el bot sigue
--  funcionando igual (solo se registra el error en logs y no se guarda nada).
--  Correr este SQL enciende la captura.
--
--  PRIVACIDAD: contiene mensajes de huéspedes. RLS ON sin políticas → solo el
--  servidor con la service-role key lee/escribe, siempre filtrando por hotel_id
--  (mismo patrón que agent_activity y el resto). El dueño solo verá los suyos.
-- ============================================================

create table if not exists public.camila_conversaciones (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  chat_id    text not null,                       -- teléfono/JID del huésped
  mensajes   jsonb not null default '[]'::jsonb,  -- [{rol:"user"|"assistant", texto, ts}]
  ultimo_at  timestamptz not null default now(),  -- último mensaje del hilo
  created_at timestamptz not null default now()
);

-- Un hilo por (hotel, teléfono): permite upsert acumulando mensajes.
create unique index if not exists camila_conv_hotel_chat_idx
  on public.camila_conversaciones (hotel_id, chat_id);

-- Para listar los hilos más recientes de un hotel.
create index if not exists camila_conv_hotel_ultimo_idx
  on public.camila_conversaciones (hotel_id, ultimo_at desc);

alter table public.camila_conversaciones enable row level security;
