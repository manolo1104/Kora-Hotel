import { ArrowRight, ExternalLink } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";

// Demo INTERACTIVO del motor: no es un mockup ni un video — es el motor real
// apuntando al hotel de demostración (extras.demo=true en la BD). El visitante
// busca fechas, arma su reserva y llega hasta el "pago", que se simula con un
// CTA de cierre. El iframe carga lazy (la sección vive bajo el fold).

const DEMO_URL = "/h/hotel-demo-huasteca/reservar";

export function DemoMotorSection() {
  return (
    <section id="demo-motor" className="py-20 sm:py-24 bg-kora-bg scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-kora-muted uppercase tracking-widest mb-2">
              Demo interactivo · Sin registrarte
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text">
              No te lo contamos: pruébalo tú mismo
            </h2>
            <p className="mt-3 text-kora-muted text-base max-w-2xl mx-auto leading-relaxed">
              Este es el motor real de Kora con un hotel de demostración. Busca
              fechas, elige un cuarto y llega hasta el pago —{" "}
              <span className="font-semibold text-kora-text">nada se cobra</span>.
              Así de fácil reservarían tus huéspedes.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="max-w-2xl mx-auto">
            {/* Marco de navegador con el motor VIVO adentro */}
            <div className="rounded-2xl bg-white shadow-2xl shadow-kora-primary/15 border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-kora-bg/60">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                <div className="ml-2 flex-1 text-center text-[10px] text-kora-muted bg-white rounded-full py-1 border border-gray-100">
                  hotel-demo-huasteca.com/reservar
                </div>
                <a
                  href={DEMO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir el demo en una pestaña nueva"
                  className="text-kora-muted hover:text-kora-primary transition-colors"
                >
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
              <iframe
                src={DEMO_URL}
                title="Demo interactivo del motor de reservas de Kora"
                loading="lazy"
                className="w-full h-[560px] sm:h-[620px] border-0 bg-white"
              />
            </div>

            <p className="mt-4 text-center text-xs text-kora-muted">
              Hotel ficticio, motor real: el mismo que se incrusta en tu web con
              una línea, con tus colores y tus tarifas.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <CtaLink
                href="/panel/onboarding"
                ctaName="demo_onboarding"
                className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Crear el mío con mi hotel
                <ArrowRight size={16} aria-hidden="true" />
              </CtaLink>
              <CtaLink
                href="/pago/iniciar?plan=kora"
                ctaName="demo_pago"
                className="btn-press inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
              >
                Empezar 30 días gratis
              </CtaLink>
            </div>
            <p className="mt-3 text-center text-xs text-kora-muted">
              Cargas tus cuartos y fotos en unos 5 minutos.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
