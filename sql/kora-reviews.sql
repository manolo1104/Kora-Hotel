-- ============================================================
--  Kora · Reseñas REALES de huéspedes — Esquema (Supabase)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
--
--  Guarda las reseñas que dejan los huéspedes DE VERDAD desde la página de
--  captura (app/h/[slug]/resena), atadas al folio de su reserva. A diferencia
--  de las reseñas tecleadas a mano (hoteles.extras.resenas), estas son
--  verificables: solo puede dejarlas quien tiene el id de una reserva real.
--  Alimentan el aggregateRating honesto de /h/[slug] y el panel de reseñas.
--
--  El código es FAIL-SAFE: mientras esta tabla no exista, todo sigue
--  funcionando igual (solo se registra el error en logs y no hay reseñas
--  capturadas). Correr este SQL las enciende.
--
--  RLS ON sin políticas: solo el servidor escribe/lee, con la service-role
--  key y filtro explícito por hotel_id (mismo patrón que el resto).
-- ============================================================

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     uuid not null references public.hoteles(id) on delete cascade,
  booking_id   uuid references public.bookings(id) on delete set null,
  confirmacion text,                       -- folio de la reserva (atadura verificable)
  cliente      text not null default 'Huésped',
  estrellas    int  not null check (estrellas between 1 and 5),
  texto        text not null default '',
  respuesta    text,                       -- respuesta pública del hotelero (opcional)
  publicada    boolean not null default true,  -- el hotelero puede ocultar una reseña
  fecha        date not null,              -- día en zona America/Mexico_City (lo pone el servidor)
  created_at   timestamptz not null default now()
);

-- Una reseña por folio: el huésped no puede dejar dos por la misma reserva
-- (el upsert del servidor la actualiza si vuelve a enviar).
create unique index if not exists reviews_hotel_confirmacion_uniq
  on public.reviews (hotel_id, confirmacion)
  where confirmacion is not null;

create index if not exists reviews_hotel_fecha_idx
  on public.reviews (hotel_id, fecha desc);

alter table public.reviews enable row level security;
