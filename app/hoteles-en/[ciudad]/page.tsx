import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { ciudades, getCiudad, TABLA_OTA_DIRECTO } from "@/lib/ciudades";
import { metaDescripcion, TENANTS_PRUEBA } from "@/lib/seo";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";
import { Reveal } from "@/components/shared/Reveal";
import { BarraCTA } from "@/components/shared/BarraCTA";

interface Props {
  params: Promise<{ ciudad: string }>;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

// ISR diario: la lista de hoteles reales por ciudad viene de Supabase y cambia
// sin deploy (cuando un hotel nuevo se publica, la página lo recoge sola).
export const revalidate = 86400;

// Hoteles publicados cuya ubicación menciona la ciudad: enlace real de la
// página de ciudad a cada mini-página (SEO local + prueba de que Kora opera ahí).
async function hotelesEnCiudad(ciudad: string): Promise<{ slug: string; nombre: string }[]> {
  if (!supabaseEnvReady) return [];
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await supabase
      .from("hoteles")
      .select("slug, nombre, ubicacion")
      .eq("publicado", true)
      .ilike("ubicacion", `%${ciudad}%`);
    return (data ?? []).filter((h) => h.slug && h.nombre && !TENANTS_PRUEBA.has(h.slug));
  } catch {
    return [];
  }
}

export function generateStaticParams() {
  return ciudades.map((c) => ({ ciudad: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad } = await params;
  const c = getCiudad(ciudad);
  if (!c) return { title: "Ciudad no encontrada — Kora" };
  return {
    title: `${c.ciudad}: reservas directas para hoteles | Kora`,
    description: metaDescripcion(c.intro),
    alternates: { canonical: `/hoteles-en/${c.slug}` },
    openGraph: {
      title: c.titulo,
      description: c.resumen,
      type: "article",
      locale: "es_MX",
    },
  };
}

export default async function CiudadPage({ params }: Props) {
  const { ciudad } = await params;
  const c = getCiudad(ciudad);
  if (!c) notFound();

  const url = `${SITE_URL}/hoteles-en/${c.slug}`;
  const hotelesReales = await hotelesEnCiudad(c.ciudad);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: c.titulo,
        serviceType: "Sistema de reservas para hoteles",
        provider: { "@id": `${SITE_URL}/#organization` },
        areaServed: { "@type": "City", name: c.ciudad, containedInPlace: { "@type": "State", name: c.estado } },
        url,
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Hoteles en México", item: `${SITE_URL}/hoteles-en` },
          { "@type": "ListItem", position: 3, name: c.ciudad, item: url },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="pt-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm text-kora-muted">
            <ol className="flex items-center gap-2 flex-wrap">
              <li>
                <Link href="/" className="hover:text-kora-primary transition-colors">Inicio</Link>
              </li>
              <li aria-hidden="true" className="text-gray-300">/</li>
              <li>
                <Link href="/hoteles-en" className="hover:text-kora-primary transition-colors">Hoteles en México</Link>
              </li>
              <li aria-hidden="true" className="text-gray-300">/</li>
              <li className="text-kora-text font-medium">{c.ciudad}</li>
            </ol>
          </nav>

          <Reveal>
            <p className="text-xs font-bold text-kora-accent uppercase tracking-widest mb-3">
              Reservas directas · {c.estado}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text leading-tight">
              {c.titulo}
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-6 bg-kora-bg border-l-4 border-kora-accent rounded-r-2xl p-5 sm:p-6">
              <p className="text-lg text-kora-text leading-relaxed">{c.intro}</p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="mt-8 space-y-5">
              {c.cuerpo.map((p, i) => (
                <p key={i} className="text-kora-text leading-relaxed">{p}</p>
              ))}
            </div>
          </Reveal>

          {/* Tabla OTA vs directo */}
          <Reveal delay={0.15}>
            <div className="mt-10 overflow-hidden rounded-2xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-kora-bg">
                    <th className="text-left font-bold text-kora-text px-4 py-3"> </th>
                    <th className="text-left font-bold text-kora-muted px-4 py-3">OTAs (Booking, Airbnb)</th>
                    <th className="text-left font-bold text-kora-primary px-4 py-3">Directo con Kora</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLA_OTA_DIRECTO.map((row, i) => (
                    <tr key={i} className={i % 2 ? "bg-white" : "bg-kora-bg/40"}>
                      <td className="px-4 py-3 font-semibold text-kora-text align-top">{row.aspecto}</td>
                      <td className="px-4 py-3 text-kora-muted align-top">{row.ota}</td>
                      <td className="px-4 py-3 text-kora-text align-top">{row.kora}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          {/* Hoteles reales que ya reservan directo en esta ciudad */}
          {hotelesReales.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold text-kora-text mb-2">
                Hoteles que ya reservan directo en {c.ciudad}
              </h2>
              <p className="text-sm text-kora-muted mb-4">
                Estos hoteles reciben reservas sin comisiones con Kora — visita su página y reserva directo:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {hotelesReales.map((h) => (
                  <Link
                    key={h.slug}
                    href={`/h/${h.slug}`}
                    className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-kora-bg px-5 py-4 transition-shadow hover:shadow-md"
                  >
                    <span className="font-semibold text-kora-text group-hover:text-kora-primary transition-colors">
                      {h.nombre}
                    </span>
                    <span aria-hidden="true" className="text-kora-primary">→</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* FAQ */}
          {c.faqs.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold text-kora-text mb-4">Preguntas frecuentes</h2>
              <div className="space-y-3">
                {c.faqs.map((f) => (
                  <Reveal key={f.q} delay={0.05}>
                    <div className="bg-kora-bg rounded-2xl p-5 border border-gray-100">
                      <h3 className="font-bold text-kora-text text-base mb-1.5">{f.q}</h3>
                      <p className="text-sm text-kora-muted leading-relaxed">{f.a}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </section>
          )}

          <p className="mt-10 text-sm text-kora-muted">
            <X size={14} className="inline mb-0.5 text-kora-muted" aria-hidden="true" /> Nota: las
            comisiones de OTAs (≈15%–20%) son rangos típicos del sector; tu acuerdo puede variar.{" "}
            <Link href="/herramientas/calculadora-comisiones" className="font-semibold text-kora-primary underline">
              Calcula lo que pagas hoy
            </Link>.
          </p>
        </div>

        <BarraCTA />
      </main>
    </>
  );
}
