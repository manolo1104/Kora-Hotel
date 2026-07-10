import { Globe, Code2, CreditCard, ArrowRight, Lock } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";

// Sección dedicada al producto ancla: el motor de reservas directas.
// El hero muestra el motor "vivo"; aquí mostramos el ángulo de propiedad:
// vive en TU web, se configura solo y el huésped paga directo (0% comisión).

const pasos = [
  {
    Icon: Globe,
    t: "Se configura solo",
    d: "Al activar tu cuenta cargas cuartos, precios y fotos en un onboarding de 2 pasos. Si sabes usar WhatsApp, sabes hacerlo.",
  },
  {
    Icon: Code2,
    t: "Vive en tu propia web",
    d: "Lo incrustamos en tu sitio con una sola línea —o te creamos uno—. Con tu logo y tus colores. Tú no tocas código.",
  },
  {
    Icon: CreditCard,
    t: "El huésped paga directo",
    d: "Cobras con Stripe (anticipo del 50%, confirmación inmediata). 0% de comisión: cada reserva es 100% tuya.",
  },
];

export function MotorReservasSection() {
  return (
    <section id="motor-reservas" className="py-20 sm:py-24 bg-white scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Texto */}
          <Reveal direction="left">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-kora-primary/70 mb-4">
                Motor de reservas directas
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text leading-tight">
                Tu propia recepción que vende sola, sin comisión
              </h2>
              <p className="mt-4 text-kora-muted text-base sm:text-lg leading-relaxed max-w-lg">
                El huésped elige fechas, ve tus cuartos y paga directo —sin pasar
                por Booking ni Airbnb—. La reserva cae confirmada en tu panel y el
                dinero es 100% tuyo.
              </p>

              <ul className="mt-8 space-y-5">
                {pasos.map(({ Icon, t, d }) => (
                  <li key={t} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-kora-accent/15 flex items-center justify-center">
                      <Icon size={18} className="text-kora-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-kora-text">{t}</p>
                      <p className="text-sm text-kora-muted leading-relaxed mt-0.5">{d}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <CtaLink
                  href="/pago/iniciar?plan=kora"
                  ctaName="motor_pago"
                  className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
                >
                  Empezar 30 días gratis
                  <ArrowRight size={16} />
                </CtaLink>
                <a
                  href="#demo-motor"
                  className="btn-press inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
                >
                  Probarlo en vivo
                </a>
              </div>
            </div>
          </Reveal>

          {/* Visual: el motor incrustado en TU web + el embed de una línea */}
          <Reveal direction="right" delay={0.1}>
            <div className="max-w-md mx-auto w-full">
              {/* Ventana de navegador: tu-hotel.com con el motor embebido */}
              <div className="rounded-2xl bg-white shadow-2xl shadow-kora-primary/20 border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-kora-bg/60">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                  <div className="ml-2 flex-1 text-center text-[10px] text-kora-muted bg-white rounded-full py-1 border border-gray-100">
                    tu-hotel.com
                  </div>
                </div>

                <div className="p-4 bg-gradient-to-b from-kora-bg/40 to-white">
                  {/* "tu web" */}
                  <div className="h-16 rounded-xl bg-gradient-to-br from-kora-primary/80 to-kora-accent mb-3 flex items-end p-3">
                    <p className="text-white font-bold text-sm">Hotel Paraíso Encantado</p>
                  </div>

                  {/* el motor de Kora incrustado */}
                  <div className="rounded-xl border-2 border-kora-accent/40 p-3 relative">
                    <span className="absolute -top-2 left-3 bg-kora-accent text-kora-primary text-[8px] font-bold px-2 py-0.5 rounded-full">
                      Motor de Kora
                    </span>
                    <div className="grid grid-cols-2 gap-2 mb-2 mt-1">
                      <div className="rounded-lg border border-gray-100 px-2 py-1.5">
                        <p className="text-[8px] text-kora-muted">Llegada</p>
                        <p className="text-[10px] font-bold text-kora-text tabular-nums">Vie 6 jun</p>
                      </div>
                      <div className="rounded-lg border border-gray-100 px-2 py-1.5">
                        <p className="text-[8px] text-kora-muted">Salida</p>
                        <p className="text-[10px] font-bold text-kora-text tabular-nums">Dom 8 jun</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-kora-bg/60 px-2.5 py-1.5 mb-2">
                      <div>
                        <p className="text-[10px] font-bold text-kora-text">Suite Jardín</p>
                        <p className="text-[8px] text-kora-muted tabular-nums">$2,400 MXN · 2 noches</p>
                      </div>
                      <span className="text-[8px] font-bold text-kora-primary bg-kora-accent/20 px-1.5 py-0.5 rounded-full">
                        Disponible
                      </span>
                    </div>
                    <div className="w-full py-2 rounded-full bg-kora-accent text-kora-primary text-[10px] font-bold inline-flex items-center justify-center gap-1">
                      <Lock size={10} /> Reservar y pagar · 0% comisión
                    </div>
                  </div>
                </div>
              </div>

              {/* El embed: una sola línea */}
              <div className="mt-4 rounded-2xl bg-kora-primary p-4">
                <p className="text-[11px] text-kora-accent font-semibold mb-2">
                  Una línea y aparece en tu web (o lo hacemos por ti):
                </p>
                <code className="block text-[10px] sm:text-[11px] text-white/90 font-mono bg-black/25 rounded-lg px-3 py-2 overflow-x-auto whitespace-nowrap">
                  {'<script src="kora-hotel.com/embed.js" data-hotel="tu-hotel"></script>'}
                </code>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
