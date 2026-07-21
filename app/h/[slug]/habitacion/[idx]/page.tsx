// Página propia de UNA habitación del motor público: galería a pantalla completa
// (clic para ampliar), descripción completa, camas, capacidad, amenidades y CTA
// para reservar ESE cuarto. El índice [idx] es la posición en hoteles.habitaciones
// (misma que usa la lista del sitio del hotel para enlazar aquí).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";
import { COLOR_DEFAULT, inkFor, fontStack, type MiniExtras } from "@/lib/mini";
import { AMENIDADES_MAP } from "@/lib/amenidades";
import { accesoDelHotel } from "@/lib/suscripcion";
import RoomDetailClient from "./RoomDetailClient";

export const dynamic = "force-dynamic";

interface Tarifa {
  personas?: string;
  precio?: string;
}
interface Habitacion {
  nombre?: string;
  precio?: string;
  descripcion?: string;
  capacidad?: string;
  fotos?: string[];
  tarifas?: Tarifa[];
  features?: string[];
  camas?: { tipo: string; cantidad: number }[];
}
interface Hotel {
  id: string;
  slug: string;
  owner_id: string;
  nombre: string;
  ubicacion: string | null;
  whatsapp: string | null;
  habitaciones: Habitacion[];
  extras: MiniExtras | null;
  created_at: string | null;
}

// Réplica mínima del fetch del sitio del hotel (app/h/[slug]/page.tsx): solo lo
// que esta página necesita, con el mismo fallback si `extras` no existe.
async function getHotel(slug: string): Promise<Hotel | null> {
  if (!supabaseEnvReady) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const base =
    "id, slug, owner_id, nombre, ubicacion, whatsapp, habitaciones, created_at";
  const run = (cols: string) =>
    supabase.from("hoteles").select(cols).eq("slug", slug).eq("publicado", true).maybeSingle();
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
function precioDesde(h: Habitacion): { texto: string | null; desde: boolean } {
  const validas = (h.tarifas ?? []).filter((t) => aNumero(t.precio) > 0);
  if (validas.length > 0) {
    const min = Math.min(...validas.map((t) => aNumero(t.precio)));
    return { texto: "$" + min.toLocaleString("es-MX") + " MXN", desde: true };
  }
  if (aNumero(h.precio) > 0) return { texto: "$" + aNumero(h.precio).toLocaleString("es-MX") + " MXN", desde: false };
  return { texto: null, desde: false };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; idx: string }>;
}): Promise<Metadata> {
  const { slug, idx } = await params;
  const hotel = await getHotel(slug);
  const h = hotel?.habitaciones?.[Number(idx)];
  if (!hotel || !h) return { title: "Habitación" };
  const title = `${h.nombre || "Habitación"} · ${hotel.nombre}`;
  const description = (h.descripcion || `Reserva ${h.nombre || "esta habitación"} en ${hotel.nombre}.`).slice(0, 155);
  return {
    title,
    description,
    alternates: { canonical: `/h/${slug}/habitacion/${idx}` },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "es_MX",
      images: h.fotos?.[0] ? [h.fotos[0]] : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; idx: string }>;
}) {
  const { slug, idx } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) notFound();
  const i = Number(idx);
  const h = Array.isArray(hotel.habitaciones) ? hotel.habitaciones[i] : undefined;
  if (!h || !Number.isInteger(i) || i < 0) notFound();

  const extras = (hotel.extras ?? {}) as MiniExtras;
  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;
  const ink = inkFor(color);
  const font = fontStack(diseno.fuente);

  // Amenidades del hotel (etiquetas legibles) para listarlas en el detalle.
  const amenidades = (extras.amenidades ?? [])
    .map((k) => AMENIDADES_MAP[k]?.label)
    .filter((x): x is string => Boolean(x));

  // CTA de reserva: al motor si está activo; si no, a WhatsApp (misma regla que
  // el sitio del hotel, para no enlazar a un motor pausado).
  const acceso = await accesoDelHotel({
    owner_id: hotel.owner_id,
    created_at: hotel.created_at,
    extras: hotel.extras as Record<string, unknown> | null,
  });
  const nombre = h.nombre || "";
  const reservarHref = `/h/${slug}/reservar${nombre ? `?habitacion=${encodeURIComponent(nombre)}` : ""}`;
  const waHref = hotel.whatsapp
    ? `https://wa.me/${soloDigitos(hotel.whatsapp)}?text=${encodeURIComponent(
        `Hola, quiero reservar ${nombre ? `la ${nombre} ` : ""}en ${hotel.nombre}`,
      )}`
    : null;

  const precio = precioDesde(h);

  // JSON-LD: la habitación como HotelRoom con su Offer, ligada al Hotel de la
  // mini-página (@id) + migas para que Google entienda la jerarquía.
  const urlHotel = `https://kora-hotel.com/h/${slug}`;
  const urlCuarto = `${urlHotel}/habitacion/${i}`;
  const precioNum = precio.texto ? aNumero(precio.texto) : 0;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HotelRoom",
        "@id": `${urlCuarto}#room`,
        url: urlCuarto,
        name: nombre || "Habitación",
        ...(h.descripcion ? { description: String(h.descripcion).slice(0, 300) } : {}),
        ...(h.fotos?.length ? { image: h.fotos.filter(Boolean) } : {}),
        ...(aNumero(h.capacidad) > 0
          ? {
              occupancy: {
                "@type": "QuantitativeValue",
                maxValue: aNumero(h.capacidad),
                unitText: "personas",
              },
            }
          : {}),
        ...(Array.isArray(h.camas) && h.camas.length
          ? {
              bed: h.camas.map((c) => ({
                "@type": "BedDetails",
                typeOfBed: c.tipo,
                numberOfBeds: c.cantidad,
              })),
            }
          : {}),
        containedInPlace: { "@type": "Hotel", "@id": `${urlHotel}#hotel`, name: hotel.nombre },
        ...(precioNum > 0
          ? {
              offers: {
                "@type": "Offer",
                price: precioNum,
                priceCurrency: "MXN",
                availability: "https://schema.org/InStock",
                url: `${urlHotel}/reservar`,
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: hotel.nombre, item: urlHotel },
          { "@type": "ListItem", position: 2, name: nombre || "Habitación", item: urlCuarto },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Texto del hotelero dentro del JSON: escapar "<" evita inyección de
        // un "</script>" que rompa el bloque (misma regla que la mini-página).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <RoomDetailClient
      hotelNombre={hotel.nombre}
      ubicacion={hotel.ubicacion}
      backHref={`/h/${slug}`}
      color={color}
      ink={ink}
      font={font}
      room={{
        nombre: nombre || "Habitación",
        descripcion: h.descripcion || null,
        capacidad: aNumero(h.capacidad) || null,
        fotos: (h.fotos ?? []).filter(Boolean),
        camas: Array.isArray(h.camas) ? h.camas : [],
        features: Array.isArray(h.features) ? h.features.filter(Boolean) : [],
        precioTexto: precio.texto,
        precioDesde: precio.desde,
      }}
      amenidades={amenidades}
      motorActivo={acceso.activo}
      reservarHref={reservarHref}
      waHref={waHref}
      />
    </>
  );
}
