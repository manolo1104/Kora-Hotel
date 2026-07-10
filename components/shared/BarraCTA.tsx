import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";

export function BarraCTA() {
  return (
    <section className="py-16 sm:py-20 bg-kora-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Reveal>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            ¿Listo para transformar tu hotel?
          </h2>
          <p className="mt-3 text-kora-accent text-base leading-relaxed">
            Empieza con 30 días gratis. Un solo plan de $550/mes con
            habitaciones ilimitadas, sin permanencia; cancela cuando quieras.
          </p>
          <CtaLink
            href="/pago/iniciar?plan=kora"
            ctaName="barra_pago"
            className="btn-press btn-arrow mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white text-kora-primary font-bold text-sm hover:bg-gray-50 transition-colors"
          >
            Empezar 30 días gratis
            <ArrowRight size={16} aria-hidden="true" />
          </CtaLink>
          <div className="mt-4">
            <CtaLink
              href="/panel/onboarding"
              ctaName="barra_onboarding"
              className="text-sm font-semibold text-kora-accent underline decoration-white/30 underline-offset-4 hover:text-white transition-colors"
            >
              o empieza a cargar tu hotel ahora — sin tarjeta
            </CtaLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
