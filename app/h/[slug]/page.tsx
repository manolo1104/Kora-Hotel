import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, MessageCircle, Navigation, Users } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Reveal } from "@/components/shared/Reveal";
import { AMENIDADES_MAP } from "@/lib/amenidades";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

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
}
interface Extras {
  amenidades?: string[];
  instagram?: string;
  facebook?: string;
  mapsUrl?: string;
}
interface Hotel {
  slug: string;
  nombre: string;
  ubicacion: string | null;
  descripcion: string | null;
  whatsapp: string | null;
  habitaciones: Habitacion[];
  fotos: string[];
  extras: Extras | null;
}

async function getHotel(slug: string): Promise<Hotel | null> {
  if (!supabaseEnvReady) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const base =
    "slug, nombre, ubicacion, descripcion, whatsapp, habitaciones, fotos";
  const run = (cols: string) =>
    supabase
      .from("hoteles")
      .select(cols)
      .eq("slug", slug)
      .eq("publicado", true)
      .maybeSingle();
  // Intenta con "extras"; si la columna aún no existe en la base, usa columnas base.
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
// Precio a mostrar: el más bajo de las tarifas por persona (si hay), o el precio base.
function precioDesde(h: Habitacion): { texto: string | null; desde: boolean } {
  const validas = (h.tarifas ?? []).filter((t) => aNumero(t.precio) > 0);
  if (validas.length > 0) {
    const min = Math.min(...validas.map((t) => aNumero(t.precio)));
    return { texto: "$" + min.toLocaleString("es-MX") + " MXN", desde: true };
  }
  return { texto: fmtPrecio(h.precio), desde: false };
}
// Acepta @usuario, usuario o URL completa.
function urlRed(base: string, v?: string): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return base + s.replace(/^@/, "");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) return { title: "Hotel no encontrado" };
  return {
    title: `${hotel.nombre}${hotel.ubicacion ? ` — ${hotel.ubicacion}` : ""}`,
    description:
      hotel.descripcion?.slice(0, 155) ||
      `Reserva directo en ${hotel.nombre}.`,
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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) notFound();

  const waUrl = hotel.whatsapp
    ? `https://wa.me/${soloDigitos(hotel.whatsapp)}?text=${encodeURIComponent(
        `Hola, vi su página y quiero reservar en ${hotel.nombre}`
      )}`
    : null;

  const portada = hotel.fotos?.[0];
  const resto = hotel.fotos?.slice(1) ?? [];

  const extras = hotel.extras ?? {};
  const amenidades = (extras.amenidades ?? [])
    .map((k) => AMENIDADES_MAP[k])
    .filter(Boolean);
  const mapsUrl = (extras.mapsUrl ?? "").trim() || null;
  const igUrl = urlRed("https://instagram.com/", extras.instagram);
  const fbUrl = urlRed("https://facebook.com/", extras.facebook);

  const waHabUrl = (nombre?: string) =>
    hotel.whatsapp
      ? `https://wa.me/${soloDigitos(hotel.whatsapp)}?text=${encodeURIComponent(
          `Hola, vi su página y quiero reservar ${
            nombre ? `la ${nombre} ` : ""
          }en ${hotel.nombre}`
        )}`
      : null;

  return (
    <main className="min-h-screen bg-kora-bg">
      {/* Portada */}
      <section className="relative">
        {portada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portada}
            alt={hotel.nombre}
            className="w-full h-60 sm:h-80 object-cover"
          />
        ) : (
          <div className="w-full h-40 bg-kora-primary" />
        )}
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="-mt-12 relative bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-kora-primary tracking-tight">
              {hotel.nombre}
            </h1>
            {hotel.ubicacion && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-kora-muted">
                <MapPin size={14} aria-hidden="true" />
                {hotel.ubicacion}
              </p>
            )}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press btn-fill mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                <MessageCircle size={17} aria-hidden="true" />
                Reservar por WhatsApp
              </a>
            )}

            {(mapsUrl || igUrl || fbUrl) && (
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
            )}
          </div>
        </div>
      </section>

      <Reveal className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Descripción */}
        {hotel.descripcion && (
          <section>
            <p className="text-kora-text leading-relaxed whitespace-pre-line">
              {hotel.descripcion}
            </p>
          </section>
        )}

        {/* Fotos */}
        {resto.length > 0 && (
          <section>
            <div className="grid grid-cols-2 gap-3">
              {resto.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={hotel.nombre}
                  className="w-full h-36 sm:h-44 object-cover rounded-xl border border-gray-100"
                />
              ))}
            </div>
          </section>
        )}

        {/* Amenidades */}
        {amenidades.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-kora-text mb-3">Servicios</h2>
            <div className="flex flex-wrap gap-2">
              {amenidades.map(({ key, label, Icon }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm text-sm text-kora-text"
                >
                  <Icon size={15} className="text-kora-primary" aria-hidden={true} />
                  {label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Habitaciones */}
        {hotel.habitaciones?.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-kora-text mb-3">Habitaciones</h2>
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
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={url}
                            src={url}
                            alt={h.nombre || "Habitación"}
                            className="w-full h-24 sm:h-28 object-cover"
                          />
                        ))}
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-bold text-kora-text">
                            {h.nombre || "Habitación"}
                          </p>
                          {h.capacidad && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-kora-muted">
                              <Users size={12} aria-hidden="true" />
                              hasta {h.capacidad} personas
                            </p>
                          )}
                          {h.descripcion && (
                            <p className="mt-1 text-sm text-kora-muted leading-snug">
                              {h.descripcion}
                            </p>
                          )}
                        </div>
                        {precio.texto && (
                          <p className="shrink-0 text-right font-bold text-kora-primary tabular-nums">
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
                              <span className="font-semibold text-kora-primary">
                                {fmtPrecio(t.precio)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      {waHab && (
                        <a
                          href={waHab}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-press mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary hover:text-kora-primary-dark"
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
        )}

        {/* CTA WhatsApp final */}
        {waUrl && (
          <section className="text-center">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press btn-fill inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-kora-primary text-white font-bold text-sm hover:bg-kora-primary-dark transition-colors"
            >
              <MessageCircle size={17} aria-hidden="true" />
              Reservar por WhatsApp
            </a>
          </section>
        )}

        {/* Pie: hecho con Kora */}
        <footer className="pt-6 border-t border-gray-200 text-center">
          <Link
            href="/?utm_source=mini-pagina"
            className="text-xs text-kora-muted hover:text-kora-primary transition-colors"
          >
            Hecho con <span className="font-bold text-kora-primary">Kora</span> ·
            Crea tu página de reservas gratis
          </Link>
        </footer>
      </Reveal>
    </main>
  );
}
