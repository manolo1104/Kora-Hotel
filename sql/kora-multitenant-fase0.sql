-- ============================================================
--  Kora · Plataforma multi-tenant — Fase 0 (cimientos)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
--
--  Es ADITIVO e IDEMPOTENTE: no borra datos. Convierte el modelo
--  "un hotel por usuario" en multi-tenant real:
--   · tabla de membresías hotel_members (quién opera qué hotel y con qué rol)
--   · tablas operativas (reservas, bloqueos, cotizaciones, etc.) con hotel_id
--   · RLS de seguridad por pertenencia
--   · RPC transaccional de reserva con anti-overbooking real
--  Si alguna línea dice "already exists", puedes ignorarlo.
-- ============================================================

-- ── 0) updated_at automático (autosuficiente: si ya existe, se reemplaza igual)
create or replace function public.crm_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── 1) Tabla de membresías usuario <-> hotel <-> rol ─────────────────────────
create table if not exists public.hotel_members (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rol        text not null default 'dueno'
               check (rol in ('dueno','encargada','recepcion','limpieza','cocina')),
  created_at timestamptz not null default now(),
  unique (hotel_id, user_id)
);
create index if not exists hotel_members_user_idx  on public.hotel_members (user_id, hotel_id);
create index if not exists hotel_members_hotel_idx on public.hotel_members (hotel_id);

-- Helper: ¿el usuario actual es miembro de este hotel? (Debe ir DESPUÉS de crear
-- hotel_members porque es una función SQL y se valida al definirse.)
-- SECURITY DEFINER para que las policies consulten hotel_members sin recursión
-- de RLS. STABLE porque depende de auth.uid() dentro del request.
create or replace function public.es_miembro_hotel(h uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hotel_members m
    where m.hotel_id = h and m.user_id = auth.uid()
  );
$$;

alter table public.hotel_members enable row level security;
-- El usuario VE sus propias membresías (para resolver sus hoteles). Las
-- escrituras llegan por el trigger (definer) o por rutas server con service-role.
drop policy if exists "membresias propias" on public.hotel_members;
create policy "membresias propias"
  on public.hotel_members for select using (user_id = auth.uid());

-- ── 2) hoteles: dejar de ser "un hotel por usuario" + columnas nuevas ────────
-- Quitar el UNIQUE de owner_id (un dueño podrá tener varios hoteles).
alter table public.hoteles drop constraint if exists hoteles_owner_id_key;

-- Columnas nuevas (aditivas) para la operación multi-tenant.
alter table public.hoteles
  add column if not exists prefijo_confirmacion text,           -- ej. 'PE', 'MC'
  add column if not exists stripe_account_id    text,           -- Stripe Connect (fase 5)
  add column if not exists config               jsonb not null default '{}'::jsonb; -- email_from, pricing, bot_enabled...

-- Policies de pertenencia (se SUMAN a las de owner_id; RLS combina con OR, así
-- que no se rompe nada de lo existente). Un miembro puede leer/editar su hotel.
drop policy if exists "hoteles miembro actualizar" on public.hoteles;
create policy "hoteles miembro actualizar"
  on public.hoteles for update using (es_miembro_hotel(id)) with check (es_miembro_hotel(id));

drop policy if exists "hoteles miembro borrar" on public.hoteles;
create policy "hoteles miembro borrar"
  on public.hoteles for delete using (es_miembro_hotel(id));

-- ── 3) Auto-membresía del dueño al crear un hotel + backfill de existentes ───
create or replace function public.hoteles_seed_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hotel_members (hotel_id, user_id, rol)
  values (new.id, new.owner_id, 'dueno')
  on conflict (hotel_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists hoteles_seed_member on public.hoteles;
create trigger hoteles_seed_member
  after insert on public.hoteles
  for each row execute function public.hoteles_seed_owner_member();

-- Backfill: cada hotel ya existente registra a su dueño como miembro.
insert into public.hotel_members (hotel_id, user_id, rol)
  select id, owner_id, 'dueno' from public.hoteles
  on conflict (hotel_id, user_id) do nothing;

-- ── 4) suscripciones: pasar a "por hotel" (aditivo, compatible hacia atrás) ──
-- Solo si la tabla suscripciones ya existe en este proyecto (en algunos aún no
-- se ha corrido su schema). Si no existe, se omite sin error; cuando se cree,
-- la Fase 4 (onboarding) ya la maneja con hotel_id.
do $$
begin
  if to_regclass('public.suscripciones') is not null then
    execute 'alter table public.suscripciones drop constraint if exists suscripciones_user_id_key';
    execute 'alter table public.suscripciones add column if not exists hotel_id uuid references public.hoteles(id) on delete cascade';
    -- Un plan por hotel (cuando hotel_id está presente). Filas viejas con
    -- hotel_id NULL siguen funcionando por user_id hasta migrarlas.
    execute 'create unique index if not exists suscripciones_hotel_uidx on public.suscripciones (hotel_id) where hotel_id is not null';
    -- Backfill: ligar la suscripción existente de cada dueño a su (único) hotel.
    execute 'update public.suscripciones s set hotel_id = h.id from public.hoteles h where s.hotel_id is null and h.owner_id = s.user_id';
    execute 'drop policy if exists "suscripcion miembro leer" on public.suscripciones';
    execute 'create policy "suscripcion miembro leer" on public.suscripciones for select using (hotel_id is not null and es_miembro_hotel(hotel_id))';
  end if;
end $$;

-- ── 5) Tablas operativas (todas con hotel_id + RLS por pertenencia) ──────────
-- Reservas. Mapea 1:1 con AdminBooking de mi-hotel (rowIndex -> id).
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  hotel_id          uuid not null references public.hoteles(id) on delete cascade,
  confirmacion      text not null,
  cliente           text,
  telefono          text,
  email             text,
  checkin           date not null,
  checkout          date not null,
  noches            int,
  huespedes         int,
  habitaciones      text,                         -- "Suite Lajas, Lirios 1" (como en mi-hotel)
  total             numeric not null default 0,
  anticipo          numeric not null default 0,
  payment_intent_id text,
  estado            text not null default 'CONFIRMADA'
                      check (estado in ('CONFIRMADA','CANCELADA','MANUAL')),
  origen            text,                          -- 'web', 'manual', 'booking_com'...
  como_nos_conocio  text,
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists bookings_pi_uidx   on public.bookings (hotel_id, payment_intent_id) where payment_intent_id is not null;
create unique index if not exists bookings_conf_uidx  on public.bookings (hotel_id, confirmacion);
create index        if not exists bookings_fechas_idx on public.bookings (hotel_id, checkin, checkout);

-- Bloqueos: unifica holds de carrito (expires_at), bloqueos manuales y OTA.
create table if not exists public.blocks (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    uuid not null references public.hoteles(id) on delete cascade,
  habitacion  text not null,
  checkin     date not null,
  checkout    date not null,
  status      text not null default 'BLOQUEADO'
                check (status in ('RESERVADO','BLOQUEADO','MANTENIMIENTO','OTA','HOLD')),
  fuente_ota  text,
  booking_id  uuid references public.bookings(id) on delete cascade,
  expires_at  timestamptz,                          -- holds de carrito; null = permanente
  created_at  timestamptz not null default now()
);
create index if not exists blocks_lookup_idx  on public.blocks (hotel_id, habitacion, checkin, checkout);
create index if not exists blocks_expires_idx on public.blocks (hotel_id, expires_at);
create unique index if not exists blocks_ota_uidx
  on public.blocks (hotel_id, habitacion, checkin, checkout, status)
  where status = 'OTA';

-- Cotizaciones. Mapea con AdminQuote (id de texto propio).
create table if not exists public.quotes (
  id           text primary key,
  hotel_id     uuid not null references public.hoteles(id) on delete cascade,
  cliente      text,
  telefono     text,
  email        text,
  suite        text,
  checkin      date,
  checkout     date,
  noches       int,
  precio_total numeric not null default 0,
  estado       text not null default 'BORRADOR'
                 check (estado in ('BORRADOR','ENVIADA','ACEPTADA','EXPIRADA')),
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists quotes_hotel_idx on public.quotes (hotel_id);

-- Notas de huésped (el CRM/GuestProfile se reconstruye en memoria desde bookings).
create table if not exists public.guest_notes (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  email      text not null,
  notas      text,
  updated_at timestamptz not null default now(),
  unique (hotel_id, email)
);

-- Estatus de cuartos (housekeeping rápido).
create table if not exists public.room_statuses (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  suite      text not null,
  estado     text not null default 'DISPONIBLE'
               check (estado in ('DISPONIBLE','OCUPADA','MANTENIMIENTO','LIMPIEZA')),
  notas      text,
  updated_at timestamptz not null default now(),
  unique (hotel_id, suite)
);

-- Operaciones: limpieza y mantenimiento.
create table if not exists public.cleaning_tasks (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  suite      text not null,
  fecha      date not null,
  estado     text not null default 'PENDIENTE' check (estado in ('PENDIENTE','HECHA')),
  asignado   text,
  notas      text,
  created_at timestamptz not null default now()
);
create index if not exists cleaning_idx on public.cleaning_tasks (hotel_id, fecha);

create table if not exists public.maintenance_tasks (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  suite      text,
  titulo     text not null,
  estado     text not null default 'ABIERTA' check (estado in ('ABIERTA','EN_PROCESO','CERRADA')),
  prioridad  text default 'media' check (prioridad in ('baja','media','alta')),
  notas      text,
  created_at timestamptz not null default now()
);
create index if not exists maintenance_idx on public.maintenance_tasks (hotel_id, estado);

-- Log de emails (dedup de las 5 secuencias).
create table if not exists public.email_log (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hoteles(id) on delete cascade,
  confirmacion text,
  email_type   text not null,
  email_destino text,
  resend_id    text,
  enviado_at   timestamptz not null default now(),
  unique (hotel_id, confirmacion, email_type)
);

-- Canales OTA (Booking/Expedia vía iCal). Mapea con OTACalendar.
create table if not exists public.ota_channels (
  id           text primary key,
  hotel_id     uuid not null references public.hoteles(id) on delete cascade,
  room_name    text,
  tipo         text not null check (tipo in ('booking_com','expedia')),
  ical_url     text,
  active       boolean not null default true,
  ultima_sync  timestamptz,
  status       text not null default 'pending' check (status in ('ok','error','pending')),
  blocks_found int not null default 0
);
create index if not exists ota_channels_hotel_idx on public.ota_channels (hotel_id);

-- ── 6) RLS por pertenencia para TODAS las tablas operativas ──────────────────
-- (Red de seguridad: el código de servidor filtra SIEMPRE por hotel_id; la RLS
--  protege accesos desde el navegador / cliente anónimo.)
do $$
declare t text;
begin
  foreach t in array array[
    'bookings','blocks','quotes','guest_notes','room_statuses',
    'cleaning_tasks','maintenance_tasks','email_log','ota_channels'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s miembro todo" on public.%I;', t, t);
    execute format(
      'create policy "%s miembro todo" on public.%I for all using (es_miembro_hotel(hotel_id)) with check (es_miembro_hotel(hotel_id));',
      t, t
    );
  end loop;
end $$;

-- updated_at automático en las tablas que lo tienen (reusa crm_touch_updated_at).
do $$
declare t text;
begin
  foreach t in array array['bookings','quotes'] loop
    execute format('drop trigger if exists %I_touch on public.%I;', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.crm_touch_updated_at();',
      t, t
    );
  end loop;
end $$;

-- ── 7) RPC transaccional de reserva (anti-overbooking real) ──────────────────
-- Serializa por hotel con un advisory lock, verifica solape contra blocks
-- (half-open: el día de checkout queda libre), e inserta booking + un block
-- 'RESERVADO' por cuarto. Idempotente por (hotel_id, payment_intent_id).
create or replace function public.crear_reserva_atomica(
  p_hotel_id          uuid,
  p_habitaciones      text[],
  p_checkin           date,
  p_checkout          date,
  p_confirmacion      text,
  p_cliente           text   default null,
  p_telefono          text   default null,
  p_email             text   default null,
  p_total             numeric default 0,
  p_anticipo          numeric default 0,
  p_huespedes         int    default 1,
  p_payment_intent_id text   default null,
  p_estado            text   default 'CONFIRMADA',
  p_origen            text   default 'web',
  p_como_nos_conocio  text   default null,
  p_notas             text   default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_room       text;
  v_existing   uuid;
begin
  -- Idempotencia: si ya existe la reserva de este pago, devolverla.
  if p_payment_intent_id is not null then
    select id into v_existing from public.bookings
     where hotel_id = p_hotel_id and payment_intent_id = p_payment_intent_id;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  -- Serializar la creación de reservas de ESTE hotel.
  perform pg_advisory_xact_lock(hashtext(p_hotel_id::text));

  -- Verificar solape por cuarto contra bloqueos activos (holds vencidos no cuentan).
  foreach v_room in array p_habitaciones loop
    if exists (
      select 1 from public.blocks b
       where b.hotel_id = p_hotel_id
         and b.habitacion = v_room
         and b.checkin < p_checkout
         and p_checkin < b.checkout
         and (b.expires_at is null or b.expires_at > now())
    ) then
      raise exception 'CUARTO_NO_DISPONIBLE: %', v_room
        using errcode = 'check_violation';
    end if;
  end loop;

  -- Insertar la reserva.
  insert into public.bookings (
    hotel_id, confirmacion, cliente, telefono, email, checkin, checkout,
    noches, huespedes, habitaciones, total, anticipo, payment_intent_id,
    estado, origen, como_nos_conocio, notas
  ) values (
    p_hotel_id, p_confirmacion, p_cliente, p_telefono, p_email, p_checkin, p_checkout,
    (p_checkout - p_checkin), p_huespedes, array_to_string(p_habitaciones, ', '),
    p_total, p_anticipo, p_payment_intent_id,
    p_estado, p_origen, p_como_nos_conocio, p_notas
  )
  returning id into v_booking_id;

  -- Un bloqueo 'RESERVADO' por cuarto (fuente de verdad de ocupación).
  foreach v_room in array p_habitaciones loop
    insert into public.blocks (hotel_id, habitacion, checkin, checkout, status, booking_id)
    values (p_hotel_id, v_room, p_checkin, p_checkout, 'RESERVADO', v_booking_id);
  end loop;

  return v_booking_id;
end;
$$;

-- Listo. Fase 0 aplicada.
