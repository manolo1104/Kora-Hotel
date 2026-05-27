import type { Metadata } from "next";
import { SocialProofSection } from "@/components/landing/SocialProofSection";
import { BarraCTA } from "@/components/shared/BarraCTA";

export const metadata: Metadata = {
  title: "Caso de estudio: Hotel Paraíso Encantado — Kora",
  description:
    "Cómo Hotel Paraíso Encantado en Xilitla, SLP aumentó sus reservas directas 40% y ahorra $8,400 MXN/mes en comisiones usando Kora.",
};

export default function CasoParaisoEncantadoPage() {
  return (
    <main className="pt-16">
      <section className="py-20 sm:py-28 bg-kora-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
            Caso de estudio
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Hotel Paraíso Encantado
          </h1>
          <p className="mt-3 text-white/70 text-lg">
            Xilitla, San Luis Potosí, México
          </p>
          <p className="mt-6 text-white/80 text-base leading-relaxed max-w-2xl">
            Hotel boutique de naturaleza en la Huasteca Potosina. El primer hotel
            en adoptar Kora y el caso de uso que inspiró el producto.
          </p>
        </div>
      </section>

      <SocialProofSection />

      <section className="py-16 sm:py-20 bg-kora-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-kora-text mb-4">
            Narrativa completa
          </h2>
          <div className="bg-white rounded-2xl p-8 border border-gray-100">
            <p className="text-kora-muted text-sm font-medium">
              TODO: Agregar narrativa completa del caso, capturas del sistema en
              uso, cronología de implementación y resultados mensuales.
            </p>
          </div>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
