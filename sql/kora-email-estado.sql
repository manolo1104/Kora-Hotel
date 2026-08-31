-- ────────────────────────────────────────────────────────────────────────────
-- Bitácora de correos que NO salieron, y su reintento. Paso 7.6 de la auditoría.
--
-- QUÉ ARREGLA. `enviarEmail` nunca lanza: ante un fallo de red, un dominio sin
-- verificar o una clave revocada devuelve `{ok:false}` y el flujo sigue. Eso está
-- bien —una reserva no se puede caer porque el correo falle— pero hasta ahora el
-- fallo moría en un `console.error` que nadie lee: el huésped se quedaba sin su
-- confirmación y nadie se enteraba hasta que reclamaba.
--
-- Se apoya en `email_log`, que YA existe (kora-multitenant-fase0.sql:240) con la
-- clave única correcta y que ya usan las secuencias para deduplicar. Así el
-- registro de fallos y el de envíos viven en la misma tabla y el reintento es
-- una consulta, en vez de una tabla nueva.
--
-- ES SEGURO CORRERLO MÁS DE UNA VEZ: todo lleva `if not exists`, y no toca ni
-- borra ninguna fila existente. Las filas que ya están se quedan como
-- `estado='enviado'`, que es lo que eran.
--
-- CÓMO CORRERLO: Supabase → SQL Editor → New query → pegar → Run.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.email_log add column if not exists estado text not null default 'enviado';
alter table public.email_log add column if not exists intentos int not null default 1;
alter table public.email_log add column if not exists ultimo_error text;
alter table public.email_log add column if not exists ultimo_intento_at timestamptz;

-- Sólo se indexan los fallidos: es la única consulta que hace el reintento, y
-- son un puñado frente a todo el histórico de enviados.
create index if not exists email_log_pendientes_idx
  on public.email_log (estado) where estado = 'fallido';

-- Los tres estados posibles, para que un typo no meta basura silenciosa.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_log_estado_valido'
  ) then
    alter table public.email_log
      add constraint email_log_estado_valido
      check (estado in ('enviado', 'fallido', 'agotado'));
  end if;
end $$;

-- ── COMPROBACIÓN ────────────────────────────────────────────────────────────
-- Debe devolver 4 columnas nuevas y el índice. Si sale así, quedó aplicado.
select
  (select count(*) from information_schema.columns
     where table_name = 'email_log'
       and column_name in ('estado','intentos','ultimo_error','ultimo_intento_at')) as columnas_nuevas,
  (select count(*) from pg_indexes
     where tablename = 'email_log' and indexname = 'email_log_pendientes_idx') as indice;
