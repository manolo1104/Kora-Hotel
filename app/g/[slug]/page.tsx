import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wifi, Clock, ListChecks, MapPin, MessageCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

interface Guia {
  wifi?: string;
  wifiClave?: string;
  checkin?: string;
  checkout?: string;
  reglas?: string[];
  recomendaciones?: string[];
}
interface Hotel {
  slug: string;
  nombre: string;
  ubicacion: string | null;
  whatsapp: string | null;
  guia: Guia;
}

async function getHotel(slug: string): Promise<Hotel | null> {
  if (!supabaseEnvReady) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data } = await supabase
    .from("hoteles")
    .select("slug, nombre, ubicacion, whatsapp, guia")
    .eq("slug", slug)
    .eq("publicado", true)
    .maybeSingle();
  return (data as Hotel) ?? null;
}

function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) return { title: "Guía no encontrada" };
  return {
    title: `Guía del huésped — ${hotel.nombre}`,
    description: `Todo lo que necesitas durante tu estancia en ${hotel.nombre}.`,
    robots: { index: false }, // guía interna, no para buscadores
  };
}

export default async function GuiaHuesped({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hotel = await getHotel(slug);
  if (!hotel) notFound();

  const g = hotel.guia ?? {};
  const waUrl = hotel.whatsapp
    ? `https://wa.me/${soloDigitos(hotel.whatsapp)}?text=${encodeURIComponent(
        `Hola, soy huésped de ${hotel.nombre} y tengo una pregunta`
      )}`
    : null;

  const reglas = g.reglas ?? [];
  const recomendaciones = g.recomendaciones ?? [];

  return (
    <main className="min-h-screen bg-kora-bg">
      {/* Encabezado */}
      <header className="bg-kora-primary text-white px-4 py-8 sm:py-10">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-kora-accent text-xs font-semibold uppercase tracking-widest mb-2">
            Guía del huésped
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {hotel.nombre}
          </h1>
          {hotel.ubicacion && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/70">
              <MapPin size={14} aria-hidden="true" />
              {hotel.ubicacion}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-5">
        {/* WiFi */}
        {(g.wifi || g.wifiClave) && (
          <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-kora-primary mb-3">
              <Wifi size={16} aria-hidden="true" /> WiFi
            </p>
            <div className="space-y-1.5 text-sm">
              {g.wifi && (
                <div className="flex justify-between gap-3">
                  <span className="text-kora-muted">Red</span>
                  <span className="font-semibold text-kora-text">{g.wifi}</span>
                </div>
              )}
              {g.wifiClave && (
                <div className="flex justify-between gap-3">
                  <span className="text-kora-muted">Contraseña</span>
                  <span className="font-semibold text-kora-text">{g.wifiClave}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Horarios */}
        {(g.checkin || g.checkout) && (
          <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-kora-primary mb-3">
              <Clock size={16} aria-hidden="true" /> Horarios
            </p>
            <div className="space-y-1.5 text-sm">
              {g.checkin && (
                <div className="flex justify-between gap-3">
                  <span className="text-kora-muted">Check-in</span>
                  <span className="font-semibold text-kora-text">{g.checkin}</span>
                </div>
              )}
              {g.checkout && (
                <div className="flex justify-between gap-3">
                  <span className="text-kora-muted">Check-out</span>
                  <span className="font-semibold text-kora-text">{g.checkout}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Reglas */}
        {reglas.length > 0 && (
          <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-kora-primary mb-3">
              <ListChecks size={16} aria-hidden="true" /> Reglas de la casa
            </p>
            <ul className="space-y-1.5">
              {reglas.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-kora-text/80">
                  <span className="text-kora-accent mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recomendaciones */}
        {recomendaciones.length > 0 && (
          <section className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-kora-primary mb-3">
              <MapPin size={16} aria-hidden="true" /> Qué hacer cerca
            </p>
            <ul className="space-y-1.5">
              {recomendaciones.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-kora-text/80">
                  <span className="text-kora-accent mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Contacto */}
        {waUrl && (
          <section className="text-center pt-2">
            <p className="text-sm text-kora-muted mb-3">¿Necesitas algo?</p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press btn-fill inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              <MessageCircle size={17} aria-hidden="true" />
              Escríbenos por WhatsApp
            </a>
          </section>
        )}

        <footer className="pt-6 border-t border-gray-200 text-center">
          <Link
            href="/?utm_source=guia-huesped"
            className="text-xs text-kora-muted hover:text-kora-primary transition-colors"
          >
            Hecho con <span className="font-bold text-kora-primary">Kora</span>
          </Link>
        </footer>
      </div>
    </main>
  );
}
