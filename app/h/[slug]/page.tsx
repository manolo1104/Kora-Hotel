import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, MessageCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

interface Habitacion {
  nombre?: string;
  precio?: string;
  descripcion?: string;
}
interface Hotel {
  slug: string;
  nombre: string;
  ubicacion: string | null;
  descripcion: string | null;
  whatsapp: string | null;
  habitaciones: Habitacion[];
  fotos: string[];
}

async function getHotel(slug: string): Promise<Hotel | null> {
  if (!supabaseEnvReady) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await supabase
    .from("hoteles")
    .select("slug, nombre, ubicacion, descripcion, whatsapp, habitaciones, fotos")
    .eq("slug", slug)
    .eq("publicado", true)
    .maybeSingle();
  return (data as Hotel) ?? null;
}

function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}
function fmtPrecio(p?: string): string | null {
  if (!p) return null;
  const n = Number(String(p).replace(/[^0-9.]/g, ""));
  if (!n) return p;
  return "$" + n.toLocaleString("es-MX") + " MXN";
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
          </div>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
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

        {/* Habitaciones */}
        {hotel.habitaciones?.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-kora-text mb-3">Habitaciones</h2>
            <div className="space-y-3">
              {hotel.habitaciones.map((h, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-kora-text">
                      {h.nombre || "Habitación"}
                    </p>
                    {h.descripcion && (
                      <p className="mt-0.5 text-sm text-kora-muted leading-snug">
                        {h.descripcion}
                      </p>
                    )}
                  </div>
                  {fmtPrecio(h.precio) && (
                    <p className="shrink-0 text-right font-bold text-kora-primary tabular-nums">
                      {fmtPrecio(h.precio)}
                      <span className="block text-[10px] font-normal text-kora-muted">
                        por noche
                      </span>
                    </p>
                  )}
                </div>
              ))}
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
      </div>
    </main>
  );
}
