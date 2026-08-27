-- ============================================================================
--  Kora · Etapa 3, paso 3.9 — editar una reserva deja de evaporar su ocupación
--
--  Se aplica A MANO en el editor SQL de Supabase. Idempotente
--  (`create or replace`): se puede correr las veces que haga falta.
--
--  ⚠️ CORRER ESTO **ANTES** DE DESPLEGAR EL CÓDIGO QUE LO LLAMA. Si la función
--     no existe, `updateBooking` responde error y el panel enseña un fallo al
--     editar fechas: molesto, pero SEGURO — no borra nada. Al revés (código sin
--     función) nunca destruye datos; simplemente no se puede editar.
--
--  EL PROBLEMA (K-45, K-46). Al cambiar fechas o cuartos de una reserva, el
--  panel hacía DELETE de sus `blocks` y DESPUÉS decidía con qué reconstruirlos.
--  Son dos escrituras sueltas, sin transacción: si el borrado pasa y el alta no
--  —o si la lectura intermedia falla—, queda una reserva CONFIRMADA viva con su
--  cuarto LIBRE en el calendario. Para siempre, y sin que nadie se entere hasta
--  que dos huéspedes llegan a la misma cabaña.
--
--  Aquí el borrado y el alta van en la MISMA transacción y bajo el MISMO
--  candado que `crear_reserva_atomica`, así que se serializan entre sí. Si el
--  cuarto nuevo ya está ocupado, se lanza y el rollback deja los blocks VIEJOS
--  intactos: la ocupación de antes no se pierde nunca.
-- ============================================================================

create or replace function public.resync_blocks_reserva(
  p_hotel_id   uuid,
  p_booking_id uuid
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkin   date;
  v_checkout  date;
  v_habs      text;
  v_estado    text;
  v_unidades  text[];
  v_unidad    text;
begin
  -- 1) El MISMO candado que crear_reserva_atomica: mientras se re-sincroniza
  --    esta reserva, ninguna otra del hotel puede colarse en esas noches.
  perform pg_advisory_xact_lock(hashtext(p_hotel_id::text));

  select b.checkin, b.checkout, b.habitaciones, b.estado
    into v_checkin, v_checkout, v_habs, v_estado
    from public.bookings b
   where b.hotel_id = p_hotel_id and b.id = p_booking_id;

  if not found then
    raise exception 'RESERVA_NO_ENCONTRADA: %', p_booking_id using errcode = 'no_data_found';
  end if;

  -- 2) Una reserva cancelada o reembolsada no ocupa nada: se le quitan los
  --    bloqueos y se acabó. (Mismo criterio que `reservaCuenta` en el código.)
  if v_estado in ('CANCELADA', 'REEMBOLSADA') then
    delete from public.blocks
     where hotel_id = p_hotel_id and booking_id = p_booking_id;
    return '{}'::text[];
  end if;

  -- 3) `habitaciones` es un CSV de UNIDADES, a veces con un sufijo entre
  --    paréntesis ("Cabaña (2 personas)"). Se limpia igual que en el código.
  v_unidades := array(
    select u from (
      select trim(regexp_replace(x, '\s*\([^)]*\)', '', 'g')) as u
        from unnest(string_to_array(coalesce(v_habs, ''), ',')) as x
    ) t
     where u <> ''
  );

  if v_checkin is null or v_checkout is null or array_length(v_unidades, 1) is null then
    delete from public.blocks
     where hotel_id = p_hotel_id and booking_id = p_booking_id;
    return '{}'::text[];
  end if;

  -- 4) Revalidar ANTES de tocar nada, excluyendo los bloqueos de ESTA reserva
  --    (si no, la reserva chocaría contra su propia ocupación anterior).
  foreach v_unidad in array v_unidades loop
    if exists (
      select 1 from public.blocks b
       where b.hotel_id = p_hotel_id
         and b.habitacion = v_unidad
         and b.checkin < v_checkout
         and v_checkin < b.checkout
         and (b.expires_at is null or b.expires_at > now())
         and (b.booking_id is distinct from p_booking_id)
    ) then
      raise exception 'CUARTO_NO_DISPONIBLE: %', v_unidad using errcode = 'check_violation';
    end if;
  end loop;

  -- 5) Recién ahora se borra y se repone, en la MISMA transacción. Si algo
  --    fallara aquí, el rollback devuelve los bloqueos viejos.
  delete from public.blocks
   where hotel_id = p_hotel_id and booking_id = p_booking_id;

  insert into public.blocks (hotel_id, habitacion, checkin, checkout, status, booking_id)
  select p_hotel_id, u, v_checkin, v_checkout, 'RESERVADO', p_booking_id
    from unnest(v_unidades) as u;

  return v_unidades;
end;
$$;

-- Sólo la service-role la llama (desde el panel, con el hotel ya verificado).
revoke all on function public.resync_blocks_reserva(uuid, uuid) from public, anon, authenticated;

comment on function public.resync_blocks_reserva(uuid, uuid) is
  'Re-sincroniza los blocks RESERVADO de una reserva tras editarla. Borra y repone '
  'en la misma transacción y bajo el mismo advisory lock que crear_reserva_atomica: '
  'si el cuarto nuevo está ocupado, lanza y la ocupación vieja queda intacta.';


-- ─── COMPROBACIÓN ───────────────────────────────────────────────────────────
select 'resync_blocks_reserva' as funcion,
       case when to_regprocedure('public.resync_blocks_reserva(uuid,uuid)') is null
            then 'NO EXISTE ❌' else 'creada ✅' end as estado,
       case when exists (
              select 1 from pg_proc
               where oid = to_regprocedure('public.resync_blocks_reserva(uuid,uuid)')
                 and position('pg_advisory_xact_lock' in prosrc) > 0
            ) then 'con candado ✅' else 'SIN CANDADO ❌' end as candado;


-- ─── CÓMO SE DESHACE ────────────────────────────────────────────────────────
--   drop function if exists public.resync_blocks_reserva(uuid, uuid);
--   (el código vuelve al DELETE + INSERT sueltos con `git revert`)
