import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  MiniRender,
  urlRed,
  type MiniDatos,
  type MiniHabitacion,
  type MiniResena,
} from "@/components/mini/MiniRender";
import { AMENIDADES_MAP } from "@/lib/amenidades";
import {
  hoyMx,
  resolverBloques,
  resolverPaginas,
  tituloBloque,
  type Bloque,
  type MiniExtras,
} from "@/lib/mini";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";
import { ownerTienePlanActivo, accesoDelHotel } from "@/lib/suscripcion";
import { getResenasPublicadas } from "@/lib/db/reviews";
import { tienePostsPublicados } from "@/lib/hotel-blog";
import { metaDescripcion } from "@/lib/seo";
import { extraerCoords } from "@/lib/maps";

export const dynamic = "force-dynamic";

interface Hotel {
  id: string;
  slug: string;
  owner_id: string;
  nombre: string;
  ubicacion: string | null;
  descripcion: string | null;
  whatsapp: string | null;
  habitaciones: MiniHabitacion[];
  fotos: string[];
  extras: MiniExtras | null;
  created_at: string | null;
}

async function getHotel(slug: string, preview: boolean): Promise<Hotel | null> {
  if (!supabaseEnvReady) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const base = "id, slug, owner_id, nombre, ubicacion, descripcion, whatsapp, habitaciones, fotos, created_at";
  const run = (cols: string) => {
    let q = supabase.from("hoteles").select(cols).eq("slug", slug);
    if (!preview) q = q.eq("publicado", true);
    return q.maybeSingle();
  };
  let res = await run(`${base}, extras`);
  if (res.error) res = await run(base);
  return (res.data as unknown as Hotel) ?? null;
}

function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}
function aNumero(p?: string): number {
  return Number(String(p ?? "").replace(/[^0-9.]/g, ""));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug, false);
  if (!hotel) return { title: "Hotel no encontrado" };
  const description = hotel.descripcion
    ? metaDescripcion(hotel.descripcion)
    : `Reserva directo en ${hotel.nombre}${hotel.ubicacion ? `, ${hotel.ubicacion}` : ""}: confirmación inmediata y pago seguro, sin comisiones.`;
  return {
    title: `${hotel.nombre}${hotel.ubicacion ? ` — ${hotel.ubicacion}` : ""}`,
    description,
    alternates: { canonical: `/h/${slug}` },
    // La imagen OG la genera opengraph-image.tsx (portada branded 1200×630);
    // no se fija aquí para no pisar la convención de archivo.
    openGraph: {
      title: `${hotel.nombre}${hotel.ubicacion ? ` — ${hotel.ubicacion}` : ""}`,
      description,
      type: "website",
      locale: "es_MX",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function MiniPagina({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const hotel = await getHotel(slug, preview === "1");
  if (!hotel) notFound();

  const extras = hotel.extras ?? {};

  // Reseñas: las CAPTURADAS (verificadas, tabla reviews — solo huéspedes reales)
  // primero, luego las tecleadas a mano (extras.resenas, compat). El
  // aggregateRating honesto cuenta todas las que tienen estrellas válidas.
  // Fail-safe: sin la tabla reviews, capturadas = [] → idéntico a antes.
  const capturadas = await getResenasPublicadas(hotel.id);
  const resenasHT = (extras.resenas ?? [])
    .filter((r) => (r.texto ?? "").trim())
    .map((r) => ({
      estrellas: Number(r.estrellas) || 0,
      texto: r.texto ?? "",
      autor: r.autor || "Huésped",
      fecha: r.fecha || "",
      verificada: false,
      respuesta: null as string | null,
    }));
  const resenas: MiniResena[] = [
    ...capturadas
      .filter((r) => r.texto.trim())
      .map((r) => ({
        estrellas: r.estrellas,
        texto: r.texto,
        autor: r.cliente,
        fecha: r.fecha,
        verificada: true,
        respuesta: r.respuesta,
      })),
    ...resenasHT,
  ];
  const ratingItems = [
    ...capturadas.filter((r) => r.estrellas >= 1 && r.estrellas <= 5),
    ...resenasHT.filter((r) => r.estrellas >= 1 && r.estrellas <= 5),
  ];
  const rating =
    ratingItems.length > 0
      ? ratingItems.reduce((s, r) => s + r.estrellas, 0) / ratingItems.length
      : null;

  // Quitar la marca es premium: solo se respeta si el dueño tiene plan activo
  // (la decisión se toma aquí, en el render público, no en lo que guarda el panel).
  const marcaOculta =
    extras.premium?.marcaOculta === true && (await ownerTienePlanActivo(hotel.owner_id));

  // Destino de los CTAs de reserva según el plan del hotel:
  //  - prueba activa (dentro de 30 días) o suscripción pagada → motor de reservas.
  //  - gratis (prueba vencida sin pago) → WhatsApp.
  // Es la MISMA condición que gatea /reservar, así que nunca enlazamos a un motor pausado.
  const acceso = await accesoDelHotel({
    owner_id: hotel.owner_id,
    created_at: hotel.created_at,
    extras: hotel.extras as Record<string, unknown> | null,
  });
  const motorActivo = acceso.activo;

  const datos: MiniDatos = {
    slug: hotel.slug,
    nombre: hotel.nombre,
    ubicacion: hotel.ubicacion,
    descripcion: hotel.descripcion,
    whatsapp: hotel.whatsapp,
    habitaciones: hotel.habitaciones ?? [],
    fotos: hotel.fotos ?? [],
    extras,
    resenas,
    rating,
    totalResenas: ratingItems.length,
    motorActivo,
    marcaOculta,
    hoy: hoyMx(),
    // Pestañas del sitio: páginas propias visibles + Blog si hay artículos.
    nav: {
      paginas: resolverPaginas(extras)
        .filter((p) => !p.oculta)
        .map((p) => ({ slug: p.slug, titulo: p.titulo })),
      blog: await tienePostsPublicados(hotel.id),
      activo: null,
    },
  };

  // ─── SEO: JSON-LD (solo servidor) ──────────────────────────────────────────
  const amenidades = (extras.amenidades ?? []).map((k) => AMENIDADES_MAP[k]).filter(Boolean);
  const mapsUrl = (extras.mapsUrl ?? "").trim() || null;
  const mapEmbedUrl = (extras.mapEmbedUrl ?? "").trim() || null;
  const igUrl = urlRed("https://instagram.com/", extras.instagram);
  const fbUrl = urlRed("https://facebook.com/", extras.facebook);
  const redes = [igUrl, fbUrl].filter(Boolean) as string[];
  const coords = extraerCoords(mapEmbedUrl || mapsUrl || "");

  // Solo se declara al buscador lo que de verdad se está mostrando: si el hotel
  // apagó el bloque de reseñas o el de FAQ, su schema se cae con él.
  const visibles = new Set(
    resolverBloques(extras)
      .filter((b) => !b.oculto)
      .map((b) => b.tipo)
  );
  const faqsVisibles = visibles.has("faq")
    ? (extras.faqs ?? []).filter((f) => (f.pregunta ?? "").trim())
    : [];
  const resenasVisibles = visibles.has("resenas") ? resenas : [];
  const ratingVisible = visibles.has("resenas") ? rating : null;

  const preciosNum = (hotel.habitaciones ?? [])
    .flatMap((h) => [aNumero(h.precio), ...(h.tarifas ?? []).map((t) => aNumero(t.precio))])
    .filter((n) => n > 0);
  const minPrecio = preciosNum.length ? Math.min(...preciosNum) : null;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    "@id": `https://kora-hotel.com/h/${hotel.slug}#hotel`,
    url: `https://kora-hotel.com/h/${hotel.slug}`,
    name: hotel.nombre,
    ...(hotel.descripcion ? { description: hotel.descripcion.slice(0, 300) } : {}),
    ...(hotel.fotos?.length ? { image: hotel.fotos } : {}),
    ...(hotel.whatsapp ? { telephone: `+${soloDigitos(hotel.whatsapp)}` } : {}),
    ...(redes.length ? { sameAs: redes } : {}),
    ...(mapsUrl ? { hasMap: mapsUrl } : {}),
    ...(coords
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: Number(coords.lat),
            longitude: Number(coords.lng),
          },
        }
      : {}),
    currenciesAccepted: "MXN",
    ...(hotel.ubicacion
      ? { address: { "@type": "PostalAddress", addressLocality: hotel.ubicacion, addressCountry: "MX" } }
      : {}),
    ...(minPrecio ? { priceRange: `Desde $${minPrecio.toLocaleString("es-MX")} MXN` } : {}),
    ...((hotel.habitaciones ?? []).length
      ? {
          makesOffer: (hotel.habitaciones ?? [])
            .filter((h) => (h.nombre ?? "").trim() && aNumero(h.precio) > 0)
            .map((h) => ({
              "@type": "Offer",
              price: aNumero(h.precio),
              priceCurrency: "MXN",
              availability: "https://schema.org/InStock",
              url: `https://kora-hotel.com/h/${hotel.slug}/reservar`,
              itemOffered: {
                "@type": "HotelRoom",
                name: h.nombre,
                ...(h.descripcion ? { description: String(h.descripcion).slice(0, 200) } : {}),
                ...(aNumero(h.capacidad) > 0
                  ? {
                      occupancy: {
                        "@type": "QuantitativeValue",
                        maxValue: aNumero(h.capacidad),
                        unitText: "personas",
                      },
                    }
                  : {}),
              },
            })),
        }
      : {}),
    ...(amenidades.length
      ? {
          amenityFeature: amenidades.map((a) => ({
            "@type": "LocationFeatureSpecification",
            name: a.label,
            value: true,
          })),
        }
      : {}),
    ...(ratingVisible
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: ratingVisible.toFixed(1),
            reviewCount: ratingItems.length,
            bestRating: 5,
          },
        }
      : {}),
    ...(resenasVisibles.length
      ? {
          review: resenasVisibles.slice(0, 10).map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.autor || "Huésped" },
            ...(r.estrellas
              ? { reviewRating: { "@type": "Rating", ratingValue: r.estrellas, bestRating: 5 } }
              : {}),
            reviewBody: r.texto,
          })),
        }
      : {}),
  };

  // Los bloques de texto propios del hotelero también son contenido indexable:
  // se declaran como partes de la página para que el buscador y los asistentes
  // de IA los lean con su título.
  const bloquesTexto = resolverBloques(extras).filter(
    (b: Bloque) => !b.oculto && b.tipo === "texto" && (b.texto ?? "").trim()
  );

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        // El JSON incluye texto del hotelero (nombre, reseñas, FAQ): escapar "<"
        // evita que un "</script>" inyectado rompa el bloque y ejecute JS (XSS).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {faqsVisibles.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              "@id": `https://kora-hotel.com/h/${hotel.slug}#faq`,
              mainEntity: faqsVisibles.map((f) => ({
                "@type": "Question",
                name: f.pregunta,
                acceptedAnswer: { "@type": "Answer", text: f.respuesta ?? "" },
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      {bloquesTexto.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              "@id": `https://kora-hotel.com/h/${hotel.slug}#pagina`,
              url: `https://kora-hotel.com/h/${hotel.slug}`,
              name: hotel.nombre,
              hasPart: bloquesTexto.map((b) => ({
                "@type": "WebPageElement",
                name: tituloBloque(b) || hotel.nombre,
                text: (b.texto ?? "").slice(0, 1500),
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}

      {preview === "1" && (
        <div className="bg-amber-100 text-amber-900 text-center text-xs font-semibold py-2 px-4">
          Vista previa — así se verá tu página.
        </div>
      )}

      <MiniRender datos={datos} />
    </main>
  );
}
