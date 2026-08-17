// Página propia del sitio del hotel (/h/{hotel}/{pagina}): "Restaurante",
// "Bodas", "Qué hacer en Xilitla"… La crea el hotelero en el editor visual y
// vive en extras.paginas. Los segmentos estáticos hermanos (habitacion,
// reservar, resena…) ganan sobre esta ruta dinámica; además el editor rechaza
// esos slugs al crear la página (SLUGS_RESERVADOS).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { MiniRender, type MiniDatos, type MiniHabitacion } from "@/components/mini/MiniRender";
import {
  hoyMx,
  metaDescripcionPagina,
  resolverPaginas,
  type MiniExtras,
  type Pagina,
} from "@/lib/mini";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";
import { ownerTienePlanActivo, accesoDelHotel } from "@/lib/suscripcion";

export const dynamic = "force-dynamic";

const BASE_URL = "https://kora-hotel.com";

interface Hotel {
  id: string;
  slug: string;
  owner_id: string;
  nombre: string;
  ubicacion: string | null;
  whatsapp: string | null;
  habitaciones: MiniHabitacion[];
  fotos: string[];
  extras: MiniExtras | null;
  created_at: string | null;
}

async function getHotelYPagina(
  slug: string,
  slugPagina: string,
  preview: boolean
): Promise<{ hotel: Hotel; pagina: Pagina } | null> {
  if (!supabaseEnvReady) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let q = supabase
    .from("hoteles")
    .select("id, slug, owner_id, nombre, ubicacion, whatsapp, habitaciones, fotos, extras, created_at")
    .eq("slug", slug);
  if (!preview) q = q.eq("publicado", true);
  const { data } = await q.maybeSingle();
  const hotel = (data as unknown as Hotel) ?? null;
  if (!hotel) return null;
  const pagina = resolverPaginas(hotel.extras).find(
    (p) => p.slug === slugPagina && (preview || !p.oculta)
  );
  if (!pagina) return null;
  return { hotel, pagina };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; pagina: string }>;
}): Promise<Metadata> {
  const { slug, pagina: slugPagina } = await params;
  const res = await getHotelYPagina(slug, slugPagina, false);
  if (!res) return { title: "Página no encontrada" };
  const { hotel, pagina } = res;
  const title = `${pagina.titulo} · ${hotel.nombre}`;
  const description = metaDescripcionPagina(pagina, hotel.nombre);
  return {
    title,
    description,
    alternates: { canonical: `/h/${slug}/${pagina.slug}` },
    openGraph: { title, description, type: "website", locale: "es_MX" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function PaginaPropia({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; pagina: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug, pagina: slugPagina } = await params;
  const { preview } = await searchParams;
  const res = await getHotelYPagina(slug, slugPagina, preview === "1");
  if (!res) notFound();
  const { hotel, pagina } = res;
  const extras = hotel.extras ?? {};

  const marcaOculta =
    extras.premium?.marcaOculta === true && (await ownerTienePlanActivo(hotel.owner_id));
  const acceso = await accesoDelHotel({
    owner_id: hotel.owner_id,
    created_at: hotel.created_at,
    extras: hotel.extras as Record<string, unknown> | null,
  });

  const datos: MiniDatos = {
    slug: hotel.slug,
    nombre: hotel.nombre,
    ubicacion: hotel.ubicacion,
    descripcion: null,
    whatsapp: hotel.whatsapp,
    habitaciones: hotel.habitaciones ?? [],
    fotos: hotel.fotos ?? [],
    extras,
    resenas: [],
    rating: null,
    totalResenas: 0,
    motorActivo: acceso.activo,
    marcaOculta,
    hoy: hoyMx(),
    nav: {
      paginas: resolverPaginas(extras)
        .filter((p) => !p.oculta)
        .map((p) => ({ slug: p.slug, titulo: p.titulo })),
      blog: false,
    },
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${BASE_URL}/h/${hotel.slug}/${pagina.slug}`,
    url: `${BASE_URL}/h/${hotel.slug}/${pagina.slug}`,
    name: `${pagina.titulo} · ${hotel.nombre}`,
    inLanguage: "es-MX",
    isPartOf: { "@id": `${BASE_URL}/h/${hotel.slug}` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: hotel.nombre, item: `${BASE_URL}/h/${hotel.slug}` },
        {
          "@type": "ListItem",
          position: 2,
          name: pagina.titulo,
          item: `${BASE_URL}/h/${hotel.slug}/${pagina.slug}`,
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <MiniRender datos={datos} pagina={pagina} />
    </>
  );
}
