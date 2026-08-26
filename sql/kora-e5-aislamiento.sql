-- ============================================================================
--  Kora · Etapa 5 — aislamiento entre hoteles (26 ago 2026)
--
--  Se aplica A MANO en el editor SQL de Supabase. No hay herramienta de
--  migraciones en este repo: manda lo aplicado, no este archivo.
--
--  ⚠️  ORDEN OBLIGATORIO. Cada bloque se corre y se VERIFICA antes del siguiente.
--      El bloque B rompe el editor del sitio si el código desplegado todavía
--      hace `select("*")` sobre `hoteles`.
--
--  Qué NO hace este archivo, a propósito:
--    · El token del bot YA salió de `hoteles.config` (sql/kora-bot-tokens-paso1/2/3,
--      corridos el 25 ago). `hotel_bot_tokens` es exactamente la tabla que la
--      auditoría pedía crear como `hotel_secrets`. No se duplica.
--    · NO se aprieta la policy de FILA de `hoteles` (`for select using (true)`).
--      Apretarla a `publicado or es_miembro_hotel(id)` afecta al sitio público,
--      al sitemap, a las mini-páginas y al llms.txt — eso es de la etapa de
--      "publicado / cuenta bloqueada", no de ésta.
-- ============================================================================


-- ─── BLOQUE A · red de seguridad del robo de canales OTA ────────────────────
-- El código ya comprueba que un canal sea de tu hotel antes de reescribirlo
-- (app/api/admin/canales/route.ts). Este índice es lo que impide que un `upsert`
-- futuro reabra el agujero sin que nadie lo note.
create unique index if not exists ota_channels_hotel_id_uidx
  on public.ota_channels (hotel_id, id);


-- ─── BLOQUE B · el navegador deja de ver columnas que no le tocan ───────────
--
-- 🔴 ANTES DE CORRER ESTO: confirma que kora-hotel.com ya está desplegado con
--    el cambio de `components/panel/PanelEditor.tsx` (lista explícita de
--    columnas en vez de `select("*")`). Con `select("*")` y este revoke,
--    PostgREST responde "permission denied" y el editor del sitio se queda EN
--    BLANCO.
--
-- Por qué hace falta: la única policy de lectura de `hoteles` es
-- `for select using (true)`, y RLS filtra FILAS, no COLUMNAS. Con la
-- NEXT_PUBLIC_SUPABASE_ANON_KEY —que viaja en el JavaScript que descarga
-- cualquier visitante— se podía bajar `config` y `stripe_account_id` de todos
-- los hoteles. Los privilegios por columna sí existen en Postgres, y PostgREST
-- los respeta.
revoke select (config, stripe_account_id) on public.hoteles from anon, authenticated;

-- COMPROBACIÓN (pégalo en una terminal, con la ANON key, no la service-role):
--   curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/hoteles?select=slug,config" \
--        -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
--   → esperado: error de permiso sobre `config`.
--   curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/hoteles?select=slug,nombre" \
--        -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
--   → esperado: la lista de hoteles, como siempre (el sitio público no se rompe).


-- ─── BLOQUE C · columnas que el hotel no puede reescribirse a sí mismo ──────
--
-- `sql/kora-multitenant-fase0.sql:73` da UPDATE a cualquier miembro sobre TODA
-- la fila, sin restricción de columna. Consecuencias reales:
--   · un hotel BLOQUEADO por Kora podía desbloquearse solo desde la consola del
--     navegador (borrando `extras.bloqueo`) — la palanca comercial de Kora se
--     esquivaba en dos clics;
--   · alguien podía ponerse el `stripe_account_id` de otro hotel.
--
-- El trigger PRESERVA en silencio en vez de dar error, para que el editor visual
-- y el onboarding sigan guardando lo suyo sin ver fallos.
--
-- `extras.premium` NO se protege a propósito: el editor lo escribe desde el
-- navegador (la casilla "ocultar marca Kora") y su efecto real ya está gateado
-- en el servidor por `ownerTienePlanActivo()`. Protegerlo rompería el editor sin
-- ganar nada.
create or replace function public.hoteles_proteger_columnas()
returns trigger language plpgsql as $$
begin
  -- El servidor de Kora (service-role) y el admin de la base pasan de largo.
  if coalesce(auth.jwt()->>'role','') = 'service_role'
     or current_user in ('postgres','supabase_admin','service_role') then
    return new;
  end if;

  new.id                := old.id;
  new.owner_id          := old.owner_id;
  new.slug              := old.slug;
  new.stripe_account_id := old.stripe_account_id;
  new.created_at        := old.created_at;
  new.config            := old.config;   -- email_from, bot_enabled, precios…

  -- De `extras`, la llave `bloqueo` es de Kora, no del hotel.
  new.extras := (new.extras - 'bloqueo')
    || (case when old.extras ? 'bloqueo'
             then jsonb_build_object('bloqueo', old.extras->'bloqueo')
             else '{}'::jsonb end);
  return new;
end;
$$;

drop trigger if exists hoteles_proteger on public.hoteles;
create trigger hoteles_proteger before update on public.hoteles
  for each row execute function public.hoteles_proteger_columnas();

-- COMPROBACIÓN: bloquea un hotel desde /crm/hoteles y, desde el panel de ESE
-- hotel, intenta borrar `extras.bloqueo` con la consola del navegador. El update
-- responde ok, pero:
--   select slug, extras->'bloqueo' from hoteles where slug = '<slug>';
-- sigue mostrando el bloqueo, y el panel sigue enseñando la pantalla de cuenta
-- bloqueada al recargar.


-- ─── CÓMO DESHACER (inmediato y sin pérdida de datos) ───────────────────────
--   drop trigger if exists hoteles_proteger on public.hoteles;
--   grant select (config, stripe_account_id) on public.hoteles to anon, authenticated;
--   drop index if exists ota_channels_hotel_id_uidx;
