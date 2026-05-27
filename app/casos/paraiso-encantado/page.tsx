import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CasoTabs } from "@/components/cases/CasoTabs";
import { BarraCTA } from "@/components/shared/BarraCTA";

export const metadata: Metadata = {
  title: "Caso de estudio: Hotel Paraíso Encantado — Kora",
  description:
    "Cómo Hotel Paraíso Encantado en Xilitla, SLP aumentó sus reservas directas 40% y ahorra $8,400 MXN/mes en comisiones usando Kora.",
  openGraph: { images: ["/og-image.png"] },
};

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20vi%20el%20caso%20de%20Par%C3%A1iso%20Encantado%20y%20quiero%20saber%20m%C3%A1s`;

export default function CasoParaisoEncantadoPage() {
  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="py-20 sm:py-28 bg-kora-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm text-kora-accent/80 hover:text-kora-accent transition-colors mb-6"
          >
            ← Casos de estudio
          </Link>
          <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
            Caso de estudio
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Hotel Paraíso Encantado
          </h1>
          <p className="mt-3 text-white/70 text-lg">
            Xilitla, San Luis Potosí · Hotel boutique de naturaleza
          </p>
          <p className="mt-6 text-white/80 text-base leading-relaxed max-w-2xl">
            El primer hotel en adoptar Kora. Cómo pasamos del 75% de dependencia
            en OTAs a generar el 47% de reservas directas en tres meses.
          </p>

          {/* Summary metrics */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            {[
              { value: "+40%", label: "Reservas directas" },
              { value: "$8,400", label: "MXN/mes ahorrados" },
              { value: "72 hrs", label: "Para implementar" },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-white/10 rounded-2xl px-5 py-4 border border-white/10"
              >
                <p className="text-2xl font-bold text-kora-accent">{m.value}</p>
                <p className="text-sm text-white/70 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hotel info strip */}
      <section className="py-6 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-6 text-sm text-kora-muted">
            {[
              { label: "Hotel", value: "Paraíso Encantado" },
              { label: "Ubicación", value: "Xilitla, San Luis Potosí" },
              { label: "Tipo", value: "Boutique de naturaleza" },
              { label: "Habitaciones", value: "15" },
              { label: "Tiempo de implementación", value: "72 horas" },
            ].map((item) => (
              <div key={item.label}>
                <span className="font-semibold text-kora-text">
                  {item.label}:
                </span>{" "}
                {item.value}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs section */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CasoTabs />
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 bg-white border-t border-gray-100">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-kora-text mb-3">
            ¿Tu hotel tiene los mismos problemas?
          </h2>
          <p className="text-kora-muted text-sm mb-7">
            Escríbenos y en 20 minutos te mostramos cómo quedaría Kora
            configurado en tu hotel específico.
          </p>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Quiero ver el demo
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
