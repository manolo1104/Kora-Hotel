-- ============================================================
--  Kora · Plataforma multi-tenant — Fase 1 (motor + capa de datos)
--  Aditivo e idempotente. Corre DESPUÉS de la Fase 0.
-- ============================================================

-- Identificador de sesión para los holds de carrito (bloqueos temporales).
-- Permite liberar el hold de una sesión y excluir el hold propio al verificar.
alter table public.blocks
  add column if not exists hold_session text;

create index if not exists blocks_hold_session_idx
  on public.blocks (hotel_id, hold_session) where hold_session is not null;

-- Limpieza de holds vencidos (se puede llamar desde un cron de Fase 6).
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

-- Listo. Fase 1 (esquema) aplicada.
