import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { herramientas } from "@/lib/herramientas";

export const metadata: Metadata = {
  title: "Herramientas gratis para hoteles | Kora",
  description:
    "Calculadoras y herramientas gratuitas para dueños de hoteles boutique en México: comisiones de OTAs, tarifas, punto de equilibrio, impuestos y más.",
  alternates: {
    canonical: "/herramientas",
  },
};

export default function HerramientasPage() {
  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="py-16 sm:py-20 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Gratis para hoteleros
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Herramientas gratis para tu hotel
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Calculadoras simples y honestas para tomar mejores decisiones en tu
              hotel. Sin registro para usarlas.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Grid de herramientas */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {herramientas.map((h, i) => (
              <Reveal key={h.slug} delay={0.05 + i * 0.06}>
                {h.disponible ? (
                  <Link
                    href={`/herramientas/${h.slug}`}
                    className="card-hover group flex flex-col h-full bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:border-kora-accent transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl" aria-hidden="true">
                        {h.icono}
                      </span>
                      <span className="text-[10px] font-bold text-kora-accent bg-kora-accent/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                        {h.etiqueta}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-kora-text mb-1.5">
                      {h.titulo}
                    </h2>
                    <p className="text-sm text-kora-muted leading-relaxed flex-1">
                      {h.resumen}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary">
                      Usar gratis
                      <ArrowRight
                        size={15}
                        aria-hidden="true"
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </span>
                  </Link>
                ) : (
                  <div className="flex flex-col h-full bg-white/60 rounded-2xl p-6 border border-dashed border-gray-200">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl opacity-50" aria-hidden="true">
                        {h.icono}
                      </span>
                      <span className="text-[10px] font-bold text-kora-muted bg-gray-100 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                        Próximamente
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-kora-text/70 mb-1.5">
                      {h.titulo}
                    </h2>
                    <p className="text-sm text-kora-muted leading-relaxed flex-1">
                      {h.resumen}
                    </p>
                  </div>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
