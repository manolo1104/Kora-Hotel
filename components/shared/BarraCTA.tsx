import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";

export function BarraCTA() {
  return (
    <section className="py-16 sm:py-20 bg-kora-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            ¿Listo para transformar tu hotel?
          </h2>
          <p className="mt-3 text-kora-accent text-base leading-relaxed">
            Sé uno de los 10 hoteles fundadores. Setup gratis + precio especial de
            por vida.
          </p>
          <a
            href="/#contacto"
            className="btn-press mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white text-kora-primary font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            Solicitar mi lugar
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
