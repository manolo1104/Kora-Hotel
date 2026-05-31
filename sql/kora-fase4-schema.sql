-- ============================================================
--  Kora · Fase 4 — Esquema de base de datos (Supabase)
--  Pega TODO esto en: Supabase → tu proyecto → SQL Editor → New query → Run
-- ============================================================

-- 1) Tabla de hoteles (una por cuenta)
create table if not exists public.hoteles (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  slug         text not null unique,
  nombre       text not null,
  ubicacion    text,
  descripcion  text,
  whatsapp     text,
  habitaciones jsonb   not null default '[]'::jsonb,   -- [{nombre, precio, descripcion}]
  fotos        text[]  not null default '{}',          -- URLs públicas
  guia         jsonb   not null default '{}'::jsonb,    -- {wifi, checkin, checkout, reglas[], recomendaciones[]}
  publicado    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2) Seguridad por fila (RLS): cada quien edita SOLO su hotel; lectura pública
alter table public.hoteles enable row level security;

drop policy if exists "hoteles lectura publica" on public.hoteles;
create policy "hoteles lectura publica"
  on public.hoteles for select using (true);

drop policy if exists "hoteles insertar propio" on public.hoteles;
create policy "hoteles insertar propio"
  on public.hoteles for insert with check (auth.uid() = owner_id);

drop policy if exists "hoteles actualizar propio" on public.hoteles;
create policy "hoteles actualizar propio"
  on public.hoteles for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "hoteles borrar propio" on public.hoteles;
create policy "hoteles borrar propio"
  on public.hoteles for delete using (auth.uid() = owner_id);

-- 3) Almacenamiento de fotos (bucket público de lectura)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists "fotos lectura publica" on storage.objects;
create policy "fotos lectura publica"
  on storage.objects for select using (bucket_id = 'fotos');

drop policy if exists "fotos subir autenticado" on storage.objects;
create policy "fotos subir autenticado"
  on storage.objects for insert to authenticated with check (bucket_id = 'fotos');

drop policy if exists "fotos borrar propio" on storage.objects;
create policy "fotos borrar propio"
  on storage.objects for delete to authenticated using (bucket_id = 'fotos' and owner = auth.uid());

-- Listo. Si alguna línea dice "already exists", puedes ignorarlo.
