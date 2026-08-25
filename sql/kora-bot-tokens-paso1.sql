-- ═══════════════════════════════════════════════════════════════════════════
--  K-06 · PASO 1 de 3 — Se corre ANTES de desplegar. No rompe nada.
--
--  Problema: la única política de lectura de `hoteles` es `for select using
--  (true)`. Ese mecanismo no filtra COLUMNAS, así que con la llave anónima —que
--  viaja dentro del JavaScript que descarga cualquier visitante del sitio— se
--  podía hacer  GET /rest/v1/hoteles?select=slug,config  y recibir el
--  `config.agent_token` de todos los hoteles. Ese token es la credencial con la
--  que Camila se identifica ante /api/agent: con él, un anónimo sin cuenta podía
--  apagar el bot de cualquier hotel, generarle links de pago a su nombre y
--  bloquearle cuartos reales.
--
--  Este paso crea la tabla nueva y COPIA los tokens. No borra nada: el código
--  desplegado sigue leyendo de `config` y todo sigue funcionando igual.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.hotel_bot_tokens (
  hotel_id   uuid primary key references public.hoteles(id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS activo y SIN NINGUNA política: nadie que use la llave del navegador puede
-- verla. Sólo la service-role, que salta RLS, la lee. Mismo patrón que `reviews`.
alter table public.hotel_bot_tokens enable row level security;
revoke all on public.hotel_bot_tokens from anon, authenticated;

-- Copia los tokens que hoy viven en config. `on conflict do nothing` la hace
-- idempotente: se puede correr dos veces sin daño.
insert into public.hotel_bot_tokens (hotel_id, token)
select id, config->>'agent_token'
from public.hoteles
where config->>'agent_token' is not null
  and config->>'agent_token' <> ''
on conflict (hotel_id) do nothing;

-- Comprobación: estas dos cifras deben coincidir.
select
  (select count(*) from public.hoteles where config->>'agent_token' is not null) as tokens_en_config,
  (select count(*) from public.hotel_bot_tokens)                                 as tokens_copiados;
