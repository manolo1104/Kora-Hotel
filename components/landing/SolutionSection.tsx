import { Reveal } from "@/components/shared/Reveal";
import { ProductTour } from "@/components/landing/ProductTour";

export function SolutionSection() {
  return (
    <section id="caracteristicas" className="py-20 sm:py-24 bg-kora-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-kora-primary/70 mb-3">
              Todo en un solo lugar
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text">
              Todo tu hotel en una sola pantalla
            </h2>
            <p className="mt-4 text-kora-muted text-base sm:text-lg leading-relaxed">
              Reemplaza tu mezcla de herramientas sueltas. Sigue bajando y mira
              cada pieza funcionando.
            </p>
          </div>
        </Reveal>

        <ProductTour />

        <Reveal delay={0.2}>
          <p className="mt-10 text-xs text-kora-muted">
            El agente de WhatsApp con IA y el pricing dinámico están disponibles desde
            el plan Hotel (9 a 20 habitaciones).
          </p>
        </Reveal>
      </div>
    </section>
  );
}
