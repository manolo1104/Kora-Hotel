-- Blog por hotel (SEO): artículos que el hotelero escribe desde su panel con
-- ayuda de IA y se publican en /h/{hotel}/blog/{post}.
--
-- Pegar en el SQL Editor de Supabase. Aditivo e idempotente: se puede correr
-- dos veces sin romper nada. Requiere es_miembro_hotel() (kora-multitenant-fase0.sql).

create table if not exists public.hotel_blog_posts (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      uuid not null references public.hoteles(id) on delete cascade,
  slug          text not null,
  titulo        text not null,
  excerpt       text not null default '',
  portada       text,                       -- URL pública del bucket "fotos"
  contenido     text not null default '',   -- markdown mínimo (##, listas, **negritas**)
  publicado     boolean not null default false,
  publicado_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (hotel_id, slug)
);

create index if not exists hotel_blog_posts_pub_idx
  on public.hotel_blog_posts (hotel_id, publicado, publicado_at desc);

alter table public.hotel_blog_posts enable row level security;

-- Lectura: cualquiera ve lo publicado; el miembro del hotel ve también sus
-- borradores. Escrituras: solo miembros del hotel (el service-role las pasa
-- todas, como siempre).
drop policy if exists "hotel_blog_select" on public.hotel_blog_posts;
create policy "hotel_blog_select"
  on public.hotel_blog_posts for select
  using (publicado = true or public.es_miembro_hotel(hotel_id));

drop policy if exists "hotel_blog_insert" on public.hotel_blog_posts;
create policy "hotel_blog_insert"
  on public.hotel_blog_posts for insert
  with check (public.es_miembro_hotel(hotel_id));

drop policy if exists "hotel_blog_update" on public.hotel_blog_posts;
create policy "hotel_blog_update"
  on public.hotel_blog_posts for update
  using (public.es_miembro_hotel(hotel_id))
  with check (public.es_miembro_hotel(hotel_id));

drop policy if exists "hotel_blog_delete" on public.hotel_blog_posts;
create policy "hotel_blog_delete"
  on public.hotel_blog_posts for delete
  using (public.es_miembro_hotel(hotel_id));

-- updated_at automático al editar.
create or replace function public.hotel_blog_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists hotel_blog_posts_touch on public.hotel_blog_posts;
create trigger hotel_blog_posts_touch
  before update on public.hotel_blog_posts
  for each row execute function public.hotel_blog_touch_updated_at();

-- ── Usos de la IA del blog ───────────────────────────────────────────────────
-- Cada generación con IA deja una fila; el endpoint cuenta las del mes en curso
-- para aplicar el límite mensual (2 artículos con IA por hotel). Solo escribe
-- el servidor (service role): sin policy de insert, el cliente no puede
-- regalarse usos ni borrarlos.

create table if not exists public.hotel_blog_ia_usos (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hoteles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists hotel_blog_ia_usos_mes_idx
  on public.hotel_blog_ia_usos (hotel_id, created_at desc);

alter table public.hotel_blog_ia_usos enable row level security;

drop policy if exists "hotel_blog_ia_usos_select" on public.hotel_blog_ia_usos;
create policy "hotel_blog_ia_usos_select"
  on public.hotel_blog_ia_usos for select
  using (public.es_miembro_hotel(hotel_id));
