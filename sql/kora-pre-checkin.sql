-- ═══════════════════════════════════════════════════════════════════════════
--  PRE CHECK-IN — el huésped se registra desde su celular antes de llegar.
--
--  POR QUÉ: lo pidió el hotelero que paga. "Que el sistema pueda enviar
--  automáticamente un correo previo al día de la reserva, con un enlace para que
--  el huésped pueda realizar su pre check-in desde antes de llegar", porque
--  "una mala experiencia para el huésped puede ser tener que esperar demasiado
--  tiempo en recepción".
--
--  QUÉ SE GUARDA Y QUÉ NO: datos de registro y firma. **NUNCA la foto de una
--  identificación** — decisión explícita de Manolo. Se guarda el TIPO de
--  documento y sus últimos dígitos, que es lo que recepción necesita para
--  cotejar, sin custodiar imágenes de INE ni pasaportes de nadie.
--
--  TABLA CERRADA. Mismo molde que `hotel_bot_tokens`: RLS activo y CERO
--  políticas, más un `revoke` a `anon` y `authenticated`. Aquí vive el domicilio
--  y la firma de personas reales; la llave que viaja en el JavaScript del
--  navegador no debe poder leer ni una fila. Sólo la service-role entra, y el
--  aislamiento por hotel lo hace el código con `.eq("hotel_id", ...)`.
--
--  Es idempotente (`if not exists`): correrlo ES la comprobación.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.pre_checkins (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       uuid not null references public.hoteles(id) on delete cascade,
  -- Una reserva, un registro. Si el huésped lo rehace, se pisa el anterior.
  booking_id     uuid not null unique references public.bookings(id) on delete cascade,

  -- Quién es
  nombre_completo text not null,
  telefono        text,
  email           text,

  -- De dónde viene (lo que pide el registro de huéspedes de un hotel)
  domicilio       text,
  ciudad_origen   text,
  pais            text,

  -- Identificación: SÓLO el tipo y los últimos dígitos. Nunca la imagen.
  documento_tipo  text,
  documento_ref   text,

  -- La estancia
  acompanantes    jsonb not null default '[]'::jsonb,  -- [{nombre, edad}]
  hora_estimada   text,
  placas          text,

  -- Firma del huésped (PNG en data-URI, dibujada con el dedo)
  firma           text,

  acepta_reglamento boolean not null default false,
  acepta_privacidad boolean not null default false,

  -- De dónde llegó: correo, QR de la reserva, QR del mostrador o recepción.
  origen          text not null default 'correo',
  ip              text,
  created_at      timestamptz not null default now()
);

comment on table public.pre_checkins is
  'Registro que llena el huésped antes de llegar. Datos personales: tabla cerrada, sólo service-role.';
comment on column public.pre_checkins.documento_ref is
  'Últimos dígitos de la identificación. NUNCA la imagen: decisión de producto, no un pendiente.';

-- El panel lista los registros de un hotel y busca el de una reserva concreta.
create index if not exists pre_checkins_hotel_idx on public.pre_checkins (hotel_id, created_at desc);

-- CERRADA: RLS activo, cero políticas, y revoke explícito. Hacen falta LAS DOS
-- capas — un GRANT sobre la tabla sobrevive a RLS si algún día se añade una
-- política amplia (la lección de sql/kora-e5-aislamiento.sql).
alter table public.pre_checkins enable row level security;
revoke all on public.pre_checkins from anon, authenticated;

-- Comprobación: debe decir true, 0, 0.
select
  (select count(*) from pg_tables where schemaname='public' and tablename='pre_checkins' and rowsecurity) = 1
    as rls_activo,
  (select count(*) from pg_policies where schemaname='public' and tablename='pre_checkins')
    as politicas_deben_ser_cero,
  (select count(*) from information_schema.role_table_grants
     where table_name='pre_checkins' and grantee in ('anon','authenticated'))
    as permisos_publicos_deben_ser_cero;
