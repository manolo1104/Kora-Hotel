import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { AYUDA } from "@/lib/ayuda";

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
        </div>
      </section>
    </main>
  );
}
