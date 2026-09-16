import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { CtaLink } from "@/components/shared/CtaLink";
import { AYUDA } from "@/lib/ayuda";
import { GARANTIA, RUTA_REGISTRO } from "@/lib/oferta";

export const metadata: Metadata = {
  title: "Centro de ayuda | Kora",
  description:
    "Respuestas rápidas sobre tu página de reservas, los planes de Kora, pagos y soporte. Y si no encuentras algo, el chat te ayuda al instante.",
  alternates: { canonical: "/ayuda" },
};

export default function AyudaPage() {
  return (
    <main className="pt-16">
      <section className="py-16 sm:py-20 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Breadcrumbs
              items={[
                { name: "Inicio", href: "/" },
                { name: "Ayuda", href: "/ayuda" },
              ]}
            />
          </div>
          <Reveal>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-kora-accent/20 flex items-center justify-center mx-auto mb-4">
                <LifeBuoy size={26} className="text-kora-primary" aria-hidden="true" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-kora-text">
                Centro de ayuda
              </h1>
              <p className="mt-4 text-kora-muted text-lg leading-relaxed">
                Respuestas directas, sin tecnicismos. ¿No encuentras algo? Usa el
                chat de la esquina y te contesta al instante.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-14 sm:py-16 bg-kora-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AYUDA.map((a, i) => (
              <Reveal key={a.slug} delay={0.05 + i * 0.04}>
                <Link
                  href={`/ayuda/${a.slug}`}
                  className="card-hover group flex h-full flex-col justify-between rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
                >
                  <div>
                    <h2 className="text-base font-bold text-kora-text leading-snug">
                      {a.titulo}
                    </h2>
                    <p className="mt-2 text-sm text-kora-muted leading-relaxed">
                      {a.resumen}
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary">
                    Leer
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>

          {/* El centro de ayuda no tenía ninguna salida al registro: quien
              llega con dudas antes de probar se iba sin saber que puede crear
              su cuenta y verlo por dentro (el camino principal del sitio desde
              el 15 sep 2026). */}
          <Reveal delay={0.1}>
            <div className="mt-10 rounded-2xl bg-kora-primary p-6 sm:p-8 text-center">
              <p className="text-lg font-bold text-white">
                ¿Aún no tienes cuenta?
              </p>
              <p className="mt-2 text-sm text-white/75 leading-relaxed">
                Créala gratis, carga tu hotel y pruébalo por dentro.{" "}
                {GARANTIA.diasPrueba} días gratis, sin tarjeta.
              </p>
              <CtaLink
                href={RUTA_REGISTRO}
                ctaName="ayuda_registro"
                className="btn-press btn-arrow btn-fill mt-5 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Crear mi cuenta gratis
                <ArrowRight size={16} aria-hidden="true" />
              </CtaLink>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
