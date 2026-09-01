-- ─────────────────────────────────────────────────────────────────────────────
-- Kora · Limitador de abuso por IP, COMPARTIDO entre instancias (paso 9.9)
--
-- Correr en el SQL Editor de Supabase (producción). ES IDEMPOTENTE: todo lleva
-- `if not exists` o `create or replace`, así que correrlo de nuevo no hace nada
-- donde ya está aplicado y repara lo que falte. No hace falta comprobar antes si
-- ya se corrió: CORRERLO ES LA COMPROBACIÓN. No borra ni modifica ninguna fila
-- de ninguna otra tabla.
--
-- ── QUÉ ARREGLA ──────────────────────────────────────────────────────────────
--
-- Hoy `lib/api/rate-limit.ts` cuenta intentos en la MEMORIA DEL PROCESO, y
-- Vercel levanta varias instancias a la vez. Efecto real: los topes que protegen
-- nueve rutas —el login del CRM, el formulario de leads, la consulta y la
-- CANCELACIÓN de una reserva, el reenvío de confirmaciones, el soporte, el alta
-- de correo, el demo del agente y el generador de herramientas con IA— se
-- multiplican por el número de instancias vivas, y quien reparta sus peticiones
-- las esquiva del todo. En `crm/login` eso es fuerza bruta contra la contraseña
-- del fundador; en `reserva/cancelar`, cancelaciones a ciegas; en las dos rutas
-- de IA, la factura de Anthropic.
--
-- Con esto el contador vive en Postgres, así que lo comparten todas las
-- instancias. No hace falta Redis (Vercel Hobby no lo trae).
--
-- ── LO QUE NO HACE ───────────────────────────────────────────────────────────
--
-- No para a quien tenga muchas IPs. Eso no lo resuelve ningún contador; para eso
-- están el honeypot del formulario, la verificación por correo y, si algún día
-- hace falta, un WAF.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. La tabla ────────────────────────────────────────────────────────────────
--
-- Una fila por (nombre del tope, IP). `ventana_inicio` marca cuándo empezó la
-- ventana vigente; cuando expira, la misma fila se reinicia en vez de crear una
-- nueva — así la tabla crece con el número de IPs distintas, no con el de
-- peticiones.

create table if not exists public.rate_limit (
  clave          text        primary key,
  conteo         int         not null default 0,
  ventana_inicio timestamptz not null default now()
);

comment on table public.rate_limit is
  'Contador de intentos por IP compartido entre las instancias de Vercel (paso 9.9). '
  'La `clave` es "<nombre del tope>:<ip>". Se puede vaciar entera sin consecuencias: '
  'lo único que pasa es que todos los topes vuelven a empezar de cero.';

-- Para la limpieza periódica: barrer por ventana, no por clave.
create index if not exists rate_limit_ventana_idx
  on public.rate_limit (ventana_inicio);

-- Nadie con la llave del navegador toca esto. Si `anon` pudiera escribir aquí,
-- el limitador se desactivaría solo poniendo el conteo a cero; y si pudiera
-- leer, expondría las IPs de los visitantes.
alter table public.rate_limit enable row level security;
revoke all on table public.rate_limit from public, anon, authenticated;


-- 2. La función ──────────────────────────────────────────────────────────────
--
--  Suma UNO al contador de `p_clave` y devuelve `true` si con eso se pasó del
--  tope. Es atómica: el `insert … on conflict do update` toma el candado de la
--  fila, así que dos peticiones simultáneas de la misma IP no pueden leer el
--  mismo conteo y escribir el mismo +1 (que es exactamente el agujero que tiene
--  hoy el contador en memoria, incluso dentro de UNA instancia).
--
--  Devuelve `true` = pasado de la raya = responder 429.

create or replace function public.rl_consumir(
  p_clave     text,
  p_max       int,
  p_ventana_s int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conteo int;
begin
  if p_clave is null or btrim(p_clave) = '' then
    raise exception 'CLAVE_INVALIDA' using errcode = 'invalid_parameter_value';
  end if;
  if p_max is null or p_max < 1 or p_ventana_s is null or p_ventana_s < 1 then
    raise exception 'LIMITE_INVALIDO: max=%, ventana=%', p_max, p_ventana_s
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.rate_limit as r (clave, conteo, ventana_inicio)
       values (p_clave, 1, now())
  on conflict (clave) do update
       -- Si la ventana ya venció, la fila se REINICIA (conteo = 1) en vez de
       -- seguir sumando. Sin esto, una IP que se pasó una vez quedaría bloqueada
       -- para siempre.
       set conteo = case
                      when r.ventana_inicio < now() - make_interval(secs => p_ventana_s)
                      then 1
                      else r.conteo + 1
                    end,
           ventana_inicio = case
                      when r.ventana_inicio < now() - make_interval(secs => p_ventana_s)
                      then now()
                      else r.ventana_inicio
                    end
    returning r.conteo into v_conteo;

  return v_conteo > p_max;
end;
$$;

-- Sólo la service-role. Con la llave del navegador cualquiera podría llamarla
-- con claves inventadas y llenar la tabla, o gastarse el tope de otra IP.
revoke all on function public.rl_consumir(text, int, int)
  from public, anon, authenticated;


-- 3. La limpieza ─────────────────────────────────────────────────────────────
--
--  Borra las filas cuya ventana lleva más de un día cerrada. Sin esto la tabla
--  guarda una fila por cada IP que haya visitado el sitio, para siempre. La
--  llama el cron diario (`/api/cron/digest`), no un `pg_cron` — Supabase en el
--  plan gratis no lo trae.

create or replace function public.rl_limpiar()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borradas int;
begin
  delete from public.rate_limit
   where ventana_inicio < now() - interval '1 day';
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke all on function public.rl_limpiar() from public, anon, authenticated;


-- 4. Comprobación (opcional, se puede correr para ver que quedó bien) ────────
--
--   select public.rl_consumir('prueba:1.2.3.4', 2, 60);  -- false (1 de 2)
--   select public.rl_consumir('prueba:1.2.3.4', 2, 60);  -- false (2 de 2)
--   select public.rl_consumir('prueba:1.2.3.4', 2, 60);  -- TRUE  (3 > 2)
--   delete from public.rate_limit where clave = 'prueba:1.2.3.4';
