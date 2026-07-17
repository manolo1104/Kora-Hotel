import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HotelImage } from "@/components/HotelImage";
import {
  MapPin,
  MessageCircle,
  Navigation,
  Users,
  Star,
  CreditCard,
  Languages,
  ShieldCheck,
  BedDouble,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Reveal } from "@/components/shared/Reveal";
import { ReservaForm } from "@/components/mini/ReservaForm";
import { AMENIDADES_MAP } from "@/lib/amenidades";
import {
  COLOR_DEFAULT,
  inkFor,
  fontStack,
  ordenSecciones,
  type MiniExtras,
} from "@/lib/mini";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";
import { ownerTienePlanActivo } from "@/lib/suscripcion";
import { getResenasPublicadas } from "@/lib/db/reviews";

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
  descripcion: string | null;
  whatsapp: string | null;
  habitaciones: Habitacion[];
  fotos: string[];
  extras: MiniExtras | null;
}

async function getHotel(slug: string, preview: boolean): Promise<Hotel | null> {
  if (!supabaseEnvReady) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const base = "id, slug, owner_id, nombre, ubicacion, descripcion, whatsapp, habitaciones, fotos";
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
function fmtPrecio(p?: string): string | null {
  if (!p) return null;
  const n = aNumero(p);
  if (!n) return p;
  return "$" + n.toLocaleString("es-MX") + " MXN";
}
function precioDesde(h: Habitacion): { texto: string | null; desde: boolean } {
  const validas = (h.tarifas ?? []).filter((t) => aNumero(t.precio) > 0);
  if (validas.length > 0) {
    const min = Math.min(...validas.map((t) => aNumero(t.precio)));
    return { texto: "$" + min.toLocaleString("es-MX") + " MXN", desde: true };
  }
  return { texto: fmtPrecio(h.precio), desde: false };
}
function urlRed(base: string, v?: string): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return base + s.replace(/^@/, "");
}

function Estrellas({ valor, size = 15 }: { valor: number; size?: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${valor} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(valor) ? "fill-current" : ""}
          style={{ color: "var(--brand)" }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug, false);
  if (!hotel) return { title: "Hotel no encontrado" };
  return {
    title: `${hotel.nombre}${hotel.ubicacion ? ` — ${hotel.ubicacion}` : ""}`,
    description:
      hotel.descripcion?.slice(0, 155) || `Reserva directo en ${hotel.nombre}.`,
    alternates: { canonical: `/h/${slug}` },
    openGraph: {
      title: hotel.nombre,
      description: hotel.descripcion?.slice(0, 155) || "",
      images: hotel.fotos?.[0] ? [hotel.fotos[0]] : undefined,
      type: "website",
    },
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
  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;
  const ink = inkFor(color);
  const font = fontStack(diseno.fuente);
  const heroCompleto = diseno.heroEstilo === "completa";
  const logo = diseno.logoUrl;
  const orden = ordenSecciones(diseno.ordenSecciones);

  const amenidades = (extras.amenidades ?? [])
    .map((k) => AMENIDADES_MAP[k])
    .filter(Boolean);
  const mapsUrl = (extras.mapsUrl ?? "").trim() || null;
  const mapEmbedUrl = (extras.mapEmbedUrl ?? "").trim() || null;
  const igUrl = urlRed("https://instagram.com/", extras.instagram);
  const fbUrl = urlRed("https://facebook.com/", extras.facebook);

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
  const resenas = [
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

  const faqs = (extras.faqs ?? []).filter((f) => (f.pregunta ?? "").trim());
  const politicas = extras.politicas ?? {};
  const tienePoliticas =
    !!(politicas.cancelacion || politicas.mascotas || politicas.ninos) ||
    (extras.formasPago ?? []).length > 0 ||
    (extras.idiomas ?? []).length > 0;
  const formasPago = extras.formasPago ?? [];
  const idiomas = extras.idiomas ?? [];

  // Quitar la marca es premium: solo se respeta si el dueño tiene plan activo
  // (la decisión se toma aquí, en el render público, no en lo que guarda el panel).
  const marcaOculta =
    extras.premium?.marcaOculta === true && (await ownerTienePlanActivo(hotel.owner_id));

  const portada = hotel.fotos?.[0];
  const resto = hotel.fotos?.slice(1) ?? [];

  const waUrl = hotel.whatsapp
    ? `https://wa.me/${soloDigitos(hotel.whatsapp)}?text=${encodeURIComponent(
        `Hola, vi su página y quiero reservar en ${hotel.nombre}`
      )}`
    : null;
  const waHabUrl = (nombre?: string) =>
    hotel.whatsapp
      ? `https://wa.me/${soloDigitos(hotel.whatsapp)}?text=${encodeURIComponent(
          `Hola, vi su página y quiero reservar ${nombre ? `la ${nombre} ` : ""}en ${hotel.nombre}`
        )}`
      : null;

  // Precio mínimo (para priceRange del schema)
  const preciosNum = (hotel.habitaciones ?? [])
    .flatMap((h) => [aNumero(h.precio), ...(h.tarifas ?? []).map((t) => aNumero(t.precio))])
    .filter((n) => n > 0);
  const minPrecio = preciosNum.length ? Math.min(...preciosNum) : null;

  // JSON-LD Hotel (subtipo de LodgingBusiness) + Offer por habitación
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: hotel.nombre,
    ...(hotel.descripcion ? { description: hotel.descripcion.slice(0, 300) } : {}),
    ...(hotel.fotos?.length ? { image: hotel.fotos } : {}),
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
    ...(rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.toFixed(1),
            reviewCount: ratingItems.length,
            bestRating: 5,
          },
        }
      : {}),
    ...(resenas.length
      ? {
          review: resenas.slice(0, 10).map((r) => ({
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

  // ─── Secciones reordenables ────────────────────────────────────────────────
  const secciones: Record<string, React.ReactNode> = {
    descripcion: hotel.descripcion ? (
      <section key="descripcion">
        <p className="text-kora-text leading-relaxed whitespace-pre-line">
          {hotel.descripcion}
        </p>
      </section>
    ) : null,

    fotos:
      resto.length > 0 ? (
        <section key="fotos">
          <div className="grid grid-cols-2 gap-3">
            {resto.map((url) => (
              <HotelImage
                key={url}
                src={url}
                alt={hotel.nombre}
                className="w-full h-36 sm:h-44 rounded-xl border border-gray-100"
                sizes="(max-width: 640px) 50vw, 300px"
              />
            ))}
          </div>
        </section>
      ) : null,

    amenidades:
      amenidades.length > 0 ? (
        <section key="amenidades">
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--brand)" }}>
            Servicios
          </h2>
          <div className="flex flex-wrap gap-2">
            {amenidades.map(({ key, label, Icon }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm text-sm text-kora-text"
              >
                <Icon size={15} className="text-[var(--brand)]" aria-hidden={true} />
                {label}
              </span>
            ))}
          </div>
        </section>
      ) : null,

    habitaciones:
      hotel.habitaciones?.length > 0 ? (
        <section key="habitaciones">
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--brand)" }}>
            Habitaciones
          </h2>
          <div className="space-y-4">
            {hotel.habitaciones.map((h, i) => {
              const precio = precioDesde(h);
              const tarifas = (h.tarifas ?? []).filter((t) => aNumero(t.precio) > 0);
              const fotosHab = h.fotos ?? [];
              const waHab = waHabUrl(h.nombre);
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  {fotosHab.length > 0 && (
                    <div className="grid grid-cols-3 gap-1">
                      {fotosHab.slice(0, 3).map((url) => (
                        <HotelImage
                          key={url}
                          src={url}
                          alt={h.nombre || "Habitación"}
                          className="w-full h-24 sm:h-28"
                          sizes="(max-width: 640px) 33vw, 200px"
                        />
                      ))}
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-kora-text">{h.nombre || "Habitación"}</p>
                        {h.capacidad && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-kora-muted">
                            <Users size={12} aria-hidden="true" />
                            hasta {h.capacidad} personas
                          </p>
                        )}
                        {Array.isArray(h.camas) && h.camas.length > 0 && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-kora-muted">
                            <BedDouble size={12} aria-hidden="true" />
                            {h.camas.map((c) => `${c.cantidad} ${c.tipo}`).join(" · ")}
                          </p>
                        )}
                        {h.descripcion && (
                          <p className="mt-1 text-sm text-kora-muted leading-snug">
                            {h.descripcion}
                          </p>
                        )}
                      </div>
                      {precio.texto && (
                        <p
                          className="shrink-0 text-right font-bold tabular-nums"
                          style={{ color: "var(--brand)" }}
                        >
                          {precio.desde && (
                            <span className="block text-[10px] font-normal text-kora-muted">
                              desde
                            </span>
                          )}
                          {precio.texto}
                          <span className="block text-[10px] font-normal text-kora-muted">
                            por noche
                          </span>
                        </p>
                      )}
                    </div>

                    {tarifas.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {tarifas.map((t, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-kora-bg border border-gray-100 text-xs text-kora-text"
                          >
                            {t.personas || "?"}p
                            <span className="font-semibold" style={{ color: "var(--brand)" }}>
                              {fmtPrecio(t.precio)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {Array.isArray(h.features) && h.features.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {h.features.map((f) => (
                          <span
                            key={f}
                            className="rounded-full border border-gray-100 bg-kora-bg px-2.5 py-1 text-[11px] text-kora-text"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}

                    {waHab && (
                      <a
                        href={waHab}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-press mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
                        style={{ color: "var(--brand)" }}
                      >
                        <MessageCircle size={15} aria-hidden="true" />
                        Reservar esta habitación
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null,

    resenas:
      resenas.length > 0 ? (
        <section key="resenas">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold" style={{ color: "var(--brand)" }}>
              Lo que dicen los huéspedes
            </h2>
            {rating && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-kora-text">
                <Estrellas valor={rating} />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resenas.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between gap-2">
                  {r.estrellas >= 1 && r.estrellas <= 5 && (
                    <Estrellas valor={r.estrellas} size={14} />
                  )}
                  {r.verificada && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <ShieldCheck size={12} /> Verificada
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-kora-text leading-relaxed">“{r.texto}”</p>
                <p className="mt-2 text-xs font-semibold text-kora-muted">
                  — {r.autor || "Huésped"}
                  {r.fecha ? ` · ${r.fecha}` : ""}
                </p>
                {r.respuesta && (
                  <div className="mt-3 rounded-xl bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold text-kora-muted">
                      Respuesta de {hotel.nombre}
                    </p>
                    <p className="mt-1 text-sm text-kora-text leading-relaxed">{r.respuesta}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null,

    faq:
      faqs.length > 0 ? (
        <section key="faq">
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--brand)" }}>
            Preguntas frecuentes
          </h2>
          <div className="space-y-2">
            {faqs.map((f, i) => (
              <details
                key={i}
                className="group bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3"
              >
                <summary className="cursor-pointer list-none font-semibold text-sm text-kora-text flex items-center justify-between gap-3">
                  {f.pregunta}
                  <span className="text-kora-muted transition-transform group-open:rotate-45 text-lg leading-none">
                    +
                  </span>
                </summary>
                {f.respuesta && (
                  <p className="mt-2 text-sm text-kora-muted leading-relaxed whitespace-pre-line">
                    {f.respuesta}
                  </p>
                )}
              </details>
            ))}
          </div>
        </section>
      ) : null,

    politicas: tienePoliticas ? (
      <section key="politicas">
        <h2 className="text-lg font-bold mb-3" style={{ color: "var(--brand)" }}>
          Información útil
        </h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3 text-sm">
          {politicas.cancelacion && (
            <p className="flex gap-2">
              <ShieldCheck size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--brand)" }} aria-hidden="true" />
              <span className="text-kora-text">
                <span className="font-semibold">Cancelación:</span> {politicas.cancelacion}
              </span>
            </p>
          )}
          {politicas.mascotas && (
            <p className="text-kora-text">
              <span className="font-semibold">Mascotas:</span> {politicas.mascotas}
            </p>
          )}
          {politicas.ninos && (
            <p className="text-kora-text">
              <span className="font-semibold">Niños:</span> {politicas.ninos}
            </p>
          )}
          {formasPago.length > 0 && (
            <div className="flex items-start gap-2">
              <CreditCard size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--brand)" }} aria-hidden="true" />
              <div className="flex flex-wrap gap-1.5">
                {formasPago.map((f) => (
                  <span key={f} className="px-2.5 py-1 rounded-full bg-kora-bg border border-gray-100 text-xs text-kora-text">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          {idiomas.length > 0 && (
            <div className="flex items-start gap-2">
              <Languages size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--brand)" }} aria-hidden="true" />
              <div className="flex flex-wrap gap-1.5">
                {idiomas.map((l) => (
                  <span key={l} className="px-2.5 py-1 rounded-full bg-kora-bg border border-gray-100 text-xs text-kora-text">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    ) : null,

    ubicacion:
      mapEmbedUrl || mapsUrl ? (
        <section key="ubicacion">
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--brand)" }}>
            Ubicación
          </h2>
          {mapEmbedUrl && (
            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
              <iframe
                src={mapEmbedUrl}
                title={`Mapa de ${hotel.nombre}`}
                className="w-full h-64"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
            >
              <Navigation size={15} aria-hidden="true" /> Cómo llegar
            </a>
          )}
        </section>
      ) : null,
  };

  const socialBtns = (mapsUrl || igUrl || fbUrl) && (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
        >
          <Navigation size={15} aria-hidden="true" /> Cómo llegar
        </a>
      )}
      {igUrl && (
        <a
          href={igUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="btn-press inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-kora-text hover:border-kora-accent transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
          </svg>
        </a>
      )}
      {fbUrl && (
        <a
          href={fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Facebook"
          className="btn-press inline-flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-kora-text hover:border-kora-accent transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
          </svg>
        </a>
      )}
    </div>
  );

  return (
    <main
      className="min-h-screen bg-kora-bg"
      style={
        {
          "--brand": color,
          "--brand-ink": ink,
          fontFamily: font,
        } as React.CSSProperties
      }
    >
      <script
        type="application/ld+json"
        // El JSON incluye texto del hotelero (nombre, reseñas, FAQ): escapar "<"
        // evita que un "</script>" inyectado rompa el bloque y ejecute JS (XSS).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {preview === "1" && (
        <div className="bg-amber-100 text-amber-900 text-center text-xs font-semibold py-2 px-4">
          Vista previa — así se verá tu página. {hotel ? "" : ""}
        </div>
      )}

      {/* Portada */}
      {heroCompleto && portada ? (
        <section className="relative h-[68vh] min-h-[400px] flex items-end">
          <Image src={portada} alt={hotel.nombre} fill sizes="100vw" priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
          <div className="relative z-10 w-full max-w-2xl mx-auto px-4 sm:px-6 pb-10 text-white">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={`Logo de ${hotel.nombre}`} className="h-16 w-auto mb-4 drop-shadow" />
            )}
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight drop-shadow">
              {hotel.nombre}
            </h1>
            {hotel.ubicacion && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/90">
                <MapPin size={14} aria-hidden="true" />
                {hotel.ubicacion}
              </p>
            )}
            {rating && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm">
                <Estrellas valor={rating} />
                <span className="font-semibold">{rating.toFixed(1)}</span>
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="relative">
          {portada ? (
            <HotelImage src={portada} alt={hotel.nombre} className="w-full h-60 sm:h-80" sizes="100vw" priority />
          ) : (
            <div className="w-full h-40" style={{ backgroundColor: "var(--brand)" }} />
          )}
        </section>
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className={`${heroCompleto ? "mt-6" : "-mt-12"} relative bg-white rounded-2xl shadow-lg border border-gray-100 p-6`}>
          {!heroCompleto && (
            <>
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={`Logo de ${hotel.nombre}`} className="h-12 w-auto mb-3" />
              )}
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "var(--brand)" }}>
                {hotel.nombre}
              </h1>
              {hotel.ubicacion && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-kora-muted">
                  <MapPin size={14} aria-hidden="true" />
                  {hotel.ubicacion}
                </p>
              )}
              {rating && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-text">
                  <Estrellas valor={rating} />
                  {rating.toFixed(1)}
                  <span className="font-normal text-kora-muted">
                    ({ratingItems.length})
                  </span>
                </p>
              )}
            </>
          )}

          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press btn-fill mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm transition-colors"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
            >
              <MessageCircle size={17} aria-hidden="true" />
              Reservar por WhatsApp
            </a>
          )}

          {socialBtns}
        </div>
      </div>

      <Reveal className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Formulario de solicitud de reserva */}
        {hotel.whatsapp && (
          <ReservaForm
            hotelNombre={hotel.nombre}
            whatsapp={hotel.whatsapp}
            habitaciones={(hotel.habitaciones ?? [])
              .map((h) => h.nombre || "")
              .filter(Boolean)}
          />
        )}

        {/* Secciones reordenables */}
        {orden.map((k) => secciones[k]).filter(Boolean)}

        {/* CTA WhatsApp final */}
        {waUrl && (
          <section className="text-center">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press btn-fill inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full font-bold text-sm transition-colors"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
            >
              <MessageCircle size={17} aria-hidden="true" />
              Reservar por WhatsApp
            </a>
          </section>
        )}

        {/* Pie: hecho con Kora (oculto en premium) */}
        {!marcaOculta && (
          <footer className="pt-6 border-t border-gray-200 text-center">
            <Link
              href="/?utm_source=mini-pagina"
              className="text-xs text-kora-muted hover:text-kora-primary transition-colors"
            >
              Hecho con <span className="font-bold text-kora-primary">Kora</span> · Crea tu página de
              reservas gratis
            </Link>
          </footer>
        )}
      </Reveal>
    </main>
  );
}
