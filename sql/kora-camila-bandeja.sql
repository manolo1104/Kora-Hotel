-- ============================================================
--  Kora · Bandeja de WhatsApp en el panel — Esquema (Supabase)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
--
--  Hasta ahora la pantalla de Camila sólo dejaba LEER las conversaciones. Con
--  esto el hotelero puede además trabajarlas: etiquetarlas, callar a Camila en
--  un chat concreto para contestar él, y saber cuáles no ha leído.
--
--  Las tres columnas van sobre la tabla que ya existe (`camila_conversaciones`,
--  de sql/kora-camila-conversaciones.sql). No se crea ninguna tabla nueva.
--
--  MIENTRAS ESTE SQL NO SE CORRA no se rompe nada: el código lee con `select *`
--  y trata las columnas ausentes como vacías, así que la bandeja se ve y se lee
--  igual — sólo que las etiquetas, la pausa y los «no leídos» no se guardan.
--  Es el mismo criterio fail-safe del resto de lib/db/admin.ts.
--
--  PRIVACIDAD: la tabla sigue con RLS ON y CERO políticas. Sólo la ve el
--  servidor con la service-role key, siempre filtrando por hotel_id.
-- ============================================================

-- Etiquetas de trabajo del hotelero (Nueva, Cotizando, Reservó, Perdida,
-- Atender yo). Juego cerrado en el código, no texto libre: una bandeja con
-- etiquetas inventadas a mano deja de servir para filtrar a las dos semanas.
alter table public.camila_conversaciones
  add column if not exists etiquetas text[] not null default '{}'::text[];

-- Hasta cuándo Camila NO contesta en ESTE chat porque lo atiende una persona.
-- Vivía sólo en la memoria del runtime de Railway, así que cada despliegue —y
-- son varios al día— borraba el «yo contesto» sin avisar.
alter table public.camila_conversaciones
  add column if not exists pausado_hasta timestamptz;

-- Cuándo abrió el hotelero este hilo por última vez. Lo que hay después de esa
-- marca es lo que no ha leído.
alter table public.camila_conversaciones
  add column if not exists visto_at timestamptz;

-- El asunto del correo que se mandó, para poder enseñarlo en la ficha del
-- cliente («ya le mandaste…»). `email_log` guardaba el tipo pero no el texto,
-- así que la lista sólo podía decir "manual_llegada".
alter table public.email_log
  add column if not exists asunto text;

-- Comprobación: las cuatro columnas tienen que existir tras correr esto.
do $$
declare faltan text;
begin
  select string_agg(x, ', ') into faltan from (
    select 'camila_conversaciones.etiquetas' as x
      where not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='camila_conversaciones' and column_name='etiquetas')
    union all
    select 'camila_conversaciones.pausado_hasta'
      where not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='camila_conversaciones' and column_name='pausado_hasta')
    union all
    select 'camila_conversaciones.visto_at'
      where not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='camila_conversaciones' and column_name='visto_at')
    union all
    select 'email_log.asunto'
      where not exists (select 1 from information_schema.columns
        where table_schema='public' and table_name='email_log' and column_name='asunto')
  ) t;
  if faltan is null then
    raise notice 'OK: la bandeja de Camila ya tiene sus columnas.';
  else
    raise exception 'Faltan columnas: %', faltan;
  end if;
end $$;
