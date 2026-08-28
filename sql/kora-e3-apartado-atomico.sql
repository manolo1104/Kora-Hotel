-- ============================================================================
--  Kora · Etapa 3, lo que faltaba — pasos 3.10, 3.12, 3.14 y 3.15
--
--  Se aplica A MANO en el editor SQL de Supabase. Idempotente
--  (`create or replace` / `add column if not exists`): se puede correr las
--  veces que haga falta.
--
--  ⚠️ ORDEN: CORRER ESTE ARCHIVO **ANTES** DE DESPLEGAR EL CÓDIGO.
--     Ninguna de estas funciones hace nada por sí sola: si nadie las llama,
--     la base se queda exactamente como está. Y el código que viene después
--     está escrito para DEGRADAR al comportamiento viejo si la función no
--     existe (lo dice en el log, no lo disimula), así que el orden inverso
--     tampoco rompe nada — sólo deja los arreglos sin efecto.
--
--  ─── QUÉ ARREGLA CADA BLOQUE ───────────────────────────────────────────────
--
--  A · apartar_unidades_atomico (paso 3.10 — K-17, K-148, K-87)
--      Hoy el motor LEE las unidades libres y DESPUÉS las aparta, con toda la
--      creación de la sesión de Stripe en medio. Entre esas dos operaciones no
--      hay candado: dos huéspedes que pulsan "Pagar" a la vez sobre la última
--      cabaña ven los dos que está libre, los dos pagan, y el segundo recibe un
--      reembolso y un correo de disculpa. Aquí leer y apartar pasan a ser UNA
--      sola operación, bajo el MISMO candado que `crear_reserva_atomica`.
--      De paso: un tope de unidades por sesión (hoy una sola petición con el
--      carrito lleno aparta el hotel ENTERO 35 minutos con datos inventados) y
--      la liberación del apartado anterior del propio huésped (el del botón
--      "atrás" del navegador, que hoy se bloquea a sí mismo media hora).
--
--  B · recortar_bloqueo (paso 3.14 — K-80, K-179)
--      Desbloquear UNA noche de un bloqueo largo hoy son dos escrituras
--      sueltas: se borra el bloqueo entero y DESPUÉS se reponen los tramos de
--      antes y de después. Entre las dos, todas esas noches están vendibles; y
--      si la reposición falla, el bloqueo ya no existe y nadie se entera. Aquí
--      va todo en la misma transacción.
--
--  C · limpiar_holds_vencidos (paso 3.12 — K-265)
--      La función existe desde la fase 1 y NO LA LLAMA NADIE. Se deja aquí la
--      definición canónica (estaba duplicada en dos archivos) para que el cron
--      diario de iCal pueda invocarla.
--
--  D · blocks.stripe_session_id (paso 3.12 — K-102)
--      Al soltar el apartado hay que apagar también la sesión de pago: si no,
--      el huésped puede volver a la pestaña de Stripe y pagar por un cuarto que
--      ya no tiene apartado. Para apagarla hace falta guardar su id.
--
--  E · experiencia_ventas.hold_session (paso 3.15 — K-18, K-100)
--      El cupo de una experiencia se COMPRUEBA en la caja y se ESCRIBE en el
--      webhook. Entre una cosa y otra, cualquier número de huéspedes pasa la
--      misma comprobación y todos ganan. Con estas dos columnas el lugar se
--      aparta cuando se promete y se confirma cuando se paga.
--
--  ─── CÓMO SE DESHACE (al final del archivo está también en una sola pieza) ──
--    drop function if exists public.apartar_unidades_atomico(uuid, jsonb, date, date, text, int, int, text);
--    drop function if exists public.recortar_bloqueo(uuid, uuid, date);
--    -- Las columnas se pueden dejar: son aditivas y nada las exige.
-- ============================================================================


-- ─── BLOQUE A · apartar_unidades_atomico ────────────────────────────────────
--
--  p_asignacion es lo que hoy calcula `asignarUnidades` en el servidor, pero
--  SIN elegir todavía: se mandan las unidades CANDIDATAS de cada tipo y cuántas
--  se quieren, y es esta función —ya con el candado tomado— la que escoge.
--
--    [{"tipo":"Cabaña","cantidad":2,"unidades":["Cabaña","Cabaña 2","Cabaña 3"]}]
--
--  Devuelve el array de unidades apartadas, en el mismo orden en que se pidieron
--  los tipos. Lanza si no alcanza; nunca aparta de menos en silencio.

create or replace function public.apartar_unidades_atomico(
  p_hotel_id     uuid,
  p_asignacion   jsonb,
  p_checkin      date,
  p_checkout     date,
  p_session      text,
  p_minutos      int  default 35,
  p_max_holds    int  default 0,     -- 0 = sin tope
  p_prev_session text default null
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expira    timestamptz;
  v_prefijo   text;
  v_vivos     int;
  v_entrada   jsonb;
  v_tipo      text;
  v_cantidad  int;
  v_unidad    text;
  v_tomadas   int;
  v_asignadas text[] := '{}';
begin
  -- 0) Cordura. Son errores de programación, no de negocio: si llegan aquí es
  --    que el llamador se saltó su propia validación.
  if p_hotel_id is null or p_session is null or btrim(p_session) = '' then
    raise exception 'ARGUMENTOS_INVALIDOS: hotel y sesión son obligatorios'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_checkin is null or p_checkout is null or p_checkout <= p_checkin then
    raise exception 'FECHAS_INVALIDAS: % a %', p_checkin, p_checkout
      using errcode = 'invalid_parameter_value';
  end if;
  if p_minutos is null or p_minutos < 1 or p_minutos > 1440 then
    raise exception 'MINUTOS_INVALIDOS: %', p_minutos
      using errcode = 'invalid_parameter_value';
  end if;

  v_expira := now() + make_interval(mins => p_minutos);

  -- 1) EL CANDADO. El mismo `hashtext(hotel_id)` que `crear_reserva_atomica` y
  --    que `resync_blocks_reserva`, así que las tres se serializan entre sí:
  --    mientras se aparta, nadie más del hotel puede reservar ni re-sincronizar.
  --    Es de transacción (`_xact_`): se suelta solo al terminar, incluso si algo
  --    lanza. No hay forma de dejarlo tomado.
  perform pg_advisory_xact_lock(hashtext(p_hotel_id::text));

  -- 2) El apartado ANTERIOR de este mismo huésped se suelta aquí dentro, no en
  --    una llamada aparte. Es el caso del botón "atrás" del navegador: hoy el
  --    huésped se bloquea su propio cuarto 35 minutos y se va creyendo que el
  --    hotel se llenó. Va DESPUÉS del candado para que nadie se cuele en el
  --    hueco entre soltar y volver a tomar.
  if p_prev_session is not null and btrim(p_prev_session) <> ''
     and p_prev_session is distinct from p_session then
    delete from public.blocks
     where hotel_id = p_hotel_id and status = 'HOLD' and hold_session = p_prev_session;
  end if;

  -- 3) Y el de esta misma sesión, si lo hubiera. Hace la función IDEMPOTENTE:
  --    un reintento con la misma sesión reaparta lo mismo en vez de duplicarlo.
  delete from public.blocks
   where hotel_id = p_hotel_id and status = 'HOLD' and hold_session = p_session;

  -- 4) Tope de unidades por sesión (K-87). Hoy una sola petición con el carrito
  --    lleno aparta TODAS las unidades libres del hotel durante 35 minutos, con
  --    nombre y correo inventados y sin pagar un peso.
  --
  --    ⚠️ Esto acota lo que hace UNA sesión, no cuántas sesiones se pueden
  --    abrir. El límite por IP es otra cosa y vive en el paso 9.9 del plan;
  --    aquí no se finge que está resuelto.
  if p_max_holds is not null and p_max_holds > 0 then
    v_tomadas := 0;
    for v_entrada in select * from jsonb_array_elements(coalesce(p_asignacion, '[]'::jsonb)) loop
      v_tomadas := v_tomadas + greatest(0, coalesce((v_entrada->>'cantidad')::int, 0));
    end loop;
    if v_tomadas > p_max_holds then
      raise exception 'TOPE_DE_APARTADOS: % unidades pedidas, tope %', v_tomadas, p_max_holds
        using errcode = 'check_violation';
    end if;
  end if;

  -- 5) Elegir las unidades. Se recorren las candidatas de cada tipo EN ORDEN y
  --    se toman las primeras libres. "Libre" = ninguna fila de `blocks` viva se
  --    solapa con [checkin, checkout). Los holds vencidos no cuentan (igual que
  --    en `getOccupiedRoomNames`), y los de esta sesión ya se borraron arriba.
  for v_entrada in select * from jsonb_array_elements(coalesce(p_asignacion, '[]'::jsonb)) loop
    v_tipo     := coalesce(v_entrada->>'tipo', '(sin nombre)');
    v_cantidad := greatest(0, coalesce((v_entrada->>'cantidad')::int, 0));
    v_tomadas  := 0;

    for v_unidad in
      select u from jsonb_array_elements_text(coalesce(v_entrada->'unidades', '[]'::jsonb)) as u
    loop
      exit when v_tomadas >= v_cantidad;
      -- Una unidad ya elegida en esta misma llamada no se puede volver a
      -- elegir. Es defensivo: si dos entradas trajeran nombres repetidos, sin
      -- esto se cobrarían dos y se apartaría una.
      continue when v_unidad = any(v_asignadas);

      if not exists (
        select 1 from public.blocks b
         where b.hotel_id   = p_hotel_id
           and b.habitacion = v_unidad
           and b.checkin    < p_checkout
           and p_checkin    < b.checkout
           and (b.expires_at is null or b.expires_at > now())
      ) then
        v_asignadas := v_asignadas || v_unidad;
        v_tomadas   := v_tomadas + 1;
      end if;
    end loop;

    if v_tomadas < v_cantidad then
      raise exception 'CUARTO_NO_DISPONIBLE: % (pedidas %, libres %)', v_tipo, v_cantidad, v_tomadas
        using errcode = 'check_violation';
    end if;
  end loop;

  if array_length(v_asignadas, 1) is null then
    raise exception 'ASIGNACION_VACIA: no se pidió ninguna unidad'
      using errcode = 'invalid_parameter_value';
  end if;

  -- 6) Apartar. Misma transacción, mismo candado: entre el punto 5 y este
  --    INSERT no cabe nadie.
  insert into public.blocks (hotel_id, habitacion, checkin, checkout, status, expires_at, hold_session)
  select p_hotel_id, u, p_checkin, p_checkout, 'HOLD', v_expira, p_session
    from unnest(v_asignadas) as u;

  return v_asignadas;
end;
$$;

-- Sólo la service-role. El hotel ya viene verificado por el servidor; nadie
-- debe poder apartar cuartos con la llave del navegador.
revoke all on function public.apartar_unidades_atomico(uuid, jsonb, date, date, text, int, int, text)
  from public, anon, authenticated;


-- ─── BLOQUE B · recortar_bloqueo ────────────────────────────────────────────
--
--  Libera UNA noche de un bloqueo manual, conservando el resto. Devuelve
--  cuántos tramos quedaron (0 = el bloqueo era de una sola noche y desapareció;
--  1 = se recortó por un extremo; 2 = la noche estaba en medio y lo partió).

create or replace function public.recortar_bloqueo(
  p_hotel_id uuid,
  p_block_id uuid,
  p_fecha    date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hab      text;
  v_checkin  date;
  v_checkout date;
  v_status   text;
  v_tramos   int := 0;
begin
  if p_hotel_id is null or p_block_id is null or p_fecha is null then
    raise exception 'ARGUMENTOS_INVALIDOS' using errcode = 'invalid_parameter_value';
  end if;

  -- El mismo candado del hotel: recortar un bloqueo LIBERA noches, así que no
  -- puede correr a la vez que una reserva que las está mirando.
  perform pg_advisory_xact_lock(hashtext(p_hotel_id::text));

  -- `for update` además del candado: si dos recepcionistas desbloquean la misma
  -- noche a la vez, la segunda ve la fila ya borrada y sale por NO_ENCONTRADO
  -- en vez de reinsertar tramos duplicados.
  select b.habitacion, b.checkin, b.checkout, b.status
    into v_hab, v_checkin, v_checkout, v_status
    from public.blocks b
   where b.hotel_id = p_hotel_id
     and b.id       = p_block_id
     and b.status   in ('BLOQUEADO', 'MANTENIMIENTO')
     and b.checkin <= p_fecha
     and b.checkout > p_fecha
   for update;

  if not found then
    raise exception 'BLOQUEO_NO_ENCONTRADO: % en %', p_block_id, p_fecha
      using errcode = 'no_data_found';
  end if;

  delete from public.blocks where hotel_id = p_hotel_id and id = p_block_id;

  -- Tramo anterior [checkin, fecha) y posterior [fecha+1, checkout). Los dos
  -- INSERT y el DELETE viven en la misma transacción: o queda todo, o no queda
  -- nada y el bloqueo original sigue en pie.
  if v_checkin < p_fecha then
    insert into public.blocks (hotel_id, habitacion, checkin, checkout, status)
    values (p_hotel_id, v_hab, v_checkin, p_fecha, v_status);
    v_tramos := v_tramos + 1;
  end if;

  if v_checkout > p_fecha + 1 then
    insert into public.blocks (hotel_id, habitacion, checkin, checkout, status)
    values (p_hotel_id, v_hab, p_fecha + 1, v_checkout, v_status);
    v_tramos := v_tramos + 1;
  end if;

  return v_tramos;
end;
$$;

revoke all on function public.recortar_bloqueo(uuid, uuid, date) from public, anon, authenticated;


-- ─── BLOQUE C · limpiar_holds_vencidos (definición canónica) ────────────────
--
--  Estaba definida DOS veces (kora-multitenant-fase1.sql y kora-db-final.sql)
--  y no la llamaba nadie: los apartados vencidos se quedaban en `blocks` para
--  siempre. No causan sobreventa —todas las lecturas filtran por `expires_at`—
--  pero engordan la tabla y hacen ilegible cualquier consulta a mano.
--  Desde el paso 3.12 la llama el cron diario de iCal.

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

revoke all on function public.limpiar_holds_vencidos() from public, anon, authenticated;


-- ─── BLOQUE D · blocks.stripe_session_id ────────────────────────────────────
--
--  Aditiva y opcional. Sin ella, soltar el apartado deja viva la sesión de pago
--  de Stripe hasta 31 minutos: el huésped que le dio a "atrás" puede volver a
--  esa pestaña y pagar por un cuarto que ya no tiene apartado, y entonces el
--  webhook le crea la reserva o —si otro se lo llevó— le reembolsa.

alter table public.blocks add column if not exists stripe_session_id text;

comment on column public.blocks.stripe_session_id is
  'Sesión de Stripe Checkout que corresponde a este HOLD. Se usa para apagarla al soltar el apartado (K-102). Null en bloqueos que no vienen de una caja.';


-- ─── BLOQUE E · experiencia_ventas: cupo apartado, no sólo vendido ──────────
--
--  `confirmacion` pasa a admitir NULL: una fila con `hold_session` y sin folio
--  es un lugar APARTADO (el huésped está pagando). Al confirmar, el webhook le
--  pone el folio y le quita el vencimiento; si no paga, caduca sola.

alter table public.experiencia_ventas add column if not exists hold_session text;
alter table public.experiencia_ventas add column if not exists expires_at    timestamptz;
alter table public.experiencia_ventas alter column confirmacion drop not null;

create index if not exists experiencia_ventas_hold_idx
  on public.experiencia_ventas (hotel_id, hold_session) where hold_session is not null;

comment on column public.experiencia_ventas.hold_session is
  'Apartado del carrito que reservó estos lugares. Con confirmacion NULL = lugares apartados sin pagar todavía; caducan en expires_at.';


-- ─── COMPROBACIÓN ───────────────────────────────────────────────────────────
--  Devuelve una fila por bloque. Las cinco tienen que decir "✅".
--  (Correrla DESPUÉS de todo lo de arriba, en la misma pestaña.)

select 'A · apartar_unidades_atomico' as bloque,
       case when to_regprocedure('public.apartar_unidades_atomico(uuid, jsonb, date, date, text, int, int, text)') is not null
            then '✅ creada' else '❌ falta' end as estado
union all
select 'B · recortar_bloqueo',
       case when to_regprocedure('public.recortar_bloqueo(uuid, uuid, date)') is not null
            then '✅ creada' else '❌ falta' end
union all
select 'C · limpiar_holds_vencidos',
       case when to_regprocedure('public.limpiar_holds_vencidos()') is not null
            then '✅ creada' else '❌ falta' end
union all
select 'D · blocks.stripe_session_id',
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='blocks'
                            and column_name='stripe_session_id')
            then '✅ columna' else '❌ falta' end
union all
select 'E · experiencia_ventas apartable',
       case when exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='experiencia_ventas'
                            and column_name='hold_session')
             and exists (select 1 from information_schema.columns
                          where table_schema='public' and table_name='experiencia_ventas'
                            and column_name='confirmacion' and is_nullable='YES')
            then '✅ columnas' else '❌ falta' end;


-- ─── PRUEBA DEL BLOQUE A, SIN TOCAR NADA REAL ───────────────────────────────
--  Cambiar <hotel_id> y los nombres de unidad por los del hotel de pruebas
--  (`hotel-magico`). Usa fechas de 2027 a propósito: nadie va a reservar ahí.
--
--    -- 1) Aparta 2 de 3 candidatas → devuelve las dos primeras libres.
--    select public.apartar_unidades_atomico(
--      '<hotel_id>'::uuid,
--      '[{"tipo":"Cabaña","cantidad":2,"unidades":["Cabaña","Cabaña 2","Cabaña 3"]}]'::jsonb,
--      '2027-10-10','2027-10-12','web_prueba_1',35,7);
--
--    -- 2) Otra sesión pide 3 sobre las mismas fechas → CUARTO_NO_DISPONIBLE
--    --    (sólo queda 1). Esto es lo que hoy NO pasa y por eso hay sobreventa.
--    select public.apartar_unidades_atomico(
--      '<hotel_id>'::uuid,
--      '[{"tipo":"Cabaña","cantidad":3,"unidades":["Cabaña","Cabaña 2","Cabaña 3"]}]'::jsonb,
--      '2027-10-10','2027-10-12','web_prueba_2',35,7);
--
--    -- 3) La misma sesión pidiendo 1 → devuelve la que quedaba.
--    select public.apartar_unidades_atomico(
--      '<hotel_id>'::uuid,
--      '[{"tipo":"Cabaña","cantidad":1,"unidades":["Cabaña","Cabaña 2","Cabaña 3"]}]'::jsonb,
--      '2027-10-10','2027-10-12','web_prueba_2',35,7);
--
--    -- 4) El tope: pedir 8 con tope 7 → TOPE_DE_APARTADOS, sin apartar nada.
--
--    -- 5) Ver lo apartado y LIMPIAR (esto último NO es opcional):
--    select habitacion, checkin, checkout, hold_session, expires_at
--      from public.blocks where hold_session like 'web_prueba_%';
--    delete from public.blocks where hold_session like 'web_prueba_%';


-- ─── CÓMO SE DESHACE, ENTERO ────────────────────────────────────────────────
--    drop function if exists public.apartar_unidades_atomico(uuid, jsonb, date, date, text, int, int, text);
--    drop function if exists public.recortar_bloqueo(uuid, uuid, date);
--    -- Las columnas de D y E son aditivas: el código viejo las ignora, así que
--    -- no hace falta quitarlas. Si se quisiera:
--    --   alter table public.blocks drop column if exists stripe_session_id;
--    --   alter table public.experiencia_ventas drop column if exists hold_session;
--    --   alter table public.experiencia_ventas drop column if exists expires_at;
--    -- (`confirmacion` volvería a NOT NULL sólo si no quedan filas con NULL.)
