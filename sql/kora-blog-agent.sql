-- ══════════════════════════════════════════════════════════════════
-- KORA · Agente de blogs — tabla blog_articles
-- Correr UNA VEZ en el SQL Editor de Supabase (proyecto de producción).
-- Guarda los artículos generados por el agente (blog-agent/) que se
-- publican vía POST /api/blog/create. Los 5 artículos originales siguen
-- viviendo en lib/articles.ts; las páginas fusionan ambas fuentes.
-- ══════════════════════════════════════════════════════════════════

create table if not exists public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  author text not null default 'Manolo Covarrubias',
  category text not null default 'Gestión hotelera',
  tags text[] not null default '{}',
  image text not null default '/blog/reservas-directas.jpg',
  image_alt text not null default '',
  content text not null,
  meta_title text,
  meta_description text,
  focus_keyword text,
  secondary_keywords text[] not null default '{}',
  read_time text not null default '8 min',
  -- id del tema en blog-agent/topics.json; permite al agente saber qué
  -- temas del banco ya se publicaron sin guardar estado local
  topic_id integer,
  published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_articles_published_at_idx
  on public.blog_articles (published_at desc);

-- RLS: lectura pública SOLO de artículos publicados (el sitio los lee con
-- la anon key). Escrituras solo con service-role (el endpoint del agente).
alter table public.blog_articles enable row level security;

drop policy if exists "blog_articles_public_read" on public.blog_articles;
create policy "blog_articles_public_read"
  on public.blog_articles for select
  using (published = true);
