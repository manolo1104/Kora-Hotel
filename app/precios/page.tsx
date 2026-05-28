import type { Metadata } from "next";
import { CalculadoraROI } from "@/components/landing/CalculadoraROI";
import { PricingSection } from "@/components/landing/PricingSection";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";

export const metadata: Metadata = {
  title: "Precios — Kora",
  description:
    "Plan fundador $2,990 MXN/mes. Todo incluido: motor de reservas, agente WhatsApp, PMS, IA y más. Sin contrato anual.",
};

export default function PreciosPage() {
  return (
    <main className="pt-16">
      <section className="py-16 sm:py-20 bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-kora-text">
              Precios
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-4 text-kora-muted text-lg leading-relaxed">
              Un solo plan. Todo incluido. Sin sorpresas.
            </p>
          </Reveal>
        </div>
      </section>

      <CalculadoraROI />

      <PricingSection />

      <BarraCTA />
    </main>
  );
}
