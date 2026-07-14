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

        {/* Plan de 3 pasos (StoryBrand: la guía le da un plan claro al héroe) */}
        <Reveal delay={0.1}>
          <ol className="mb-14 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5" aria-label="Cómo empezar en 3 pasos">
            {[
              { n: "1", t: "Te montamos tu hotel en 48h", d: "Cargamos tus cuartos, fotos y tarifas. Tú no tocas nada técnico." },
              { n: "2", t: "Tu motor y Camila, listos 24/7", d: "El motor en tu web o redes y Camila contestando tu WhatsApp." },
              { n: "3", t: "Recibes reservas directas", d: "Te quedas con el 100% del pago, sin comisión de OTAs." },
            ].map((p) => (
              <li key={p.n} className="flex gap-4 p-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
                <span className="flex-shrink-0 w-9 h-9 rounded-full bg-kora-primary text-white font-bold text-sm flex items-center justify-center">
                  {p.n}
                </span>
                <div>
                  <p className="font-semibold text-kora-text text-sm sm:text-base">{p.t}</p>
                  <p className="mt-1 text-xs sm:text-sm text-kora-muted leading-relaxed">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <ProductTour />

        <Reveal delay={0.2}>
          <p className="mt-10 text-xs text-kora-muted">
            Un solo plan de $550 MXN/mes, todo incluido y con habitaciones
            ilimitadas: motor de reservas, PMS, Camila (WhatsApp con IA, 24/7),
            dashboard y CRM.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
