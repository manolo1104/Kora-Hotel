import Link from "next/link";
import { CheckCircle2, Gift, ArrowRight, ShieldCheck, BadgeCheck, Lock, X } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CountUp } from "@/components/shared/CountUp";
import { LUGARES_DISPONIBLES, TOTAL_LUGARES, VALOR_WEB, LANZAMIENTO } from "@/lib/oferta";

// Lo que incluye el sitio web profesional que construimos (el gancho gratis).
const incluyeWeb = [
  "Diseño 100% personalizado para tu hotel (no plantillas)",
  "Motor de reservas directo, sin comisiones",
  "Reseñas y social proof de tus huéspedes",
  "Señales de urgencia (pocas habitaciones, alta demanda)",
  "Tu dominio propio, hosting y certificado SSL",
  "Lo construimos, publicamos y te capacitamos",
];

// Funciones que comparten todos los planes (la base de Kora).
const featuresBase = [
  "PMS completo: habitaciones, check-in/out, housekeeping",
  "Dashboard + métricas + forecast 30 días",
  "CRM de huéspedes y emails automáticos",
  "CFDI 4.0 integrado con el SAT",
  "Soporte directo con el equipo fundador",
];

// Funciones premium (a partir del plan Hotel): IA en WhatsApp y pricing dinámico.
const featuresPremium = [
  "Agente WhatsApp con IA (24/7)",
  "Pricing dinámico con IA",
];

// Plan completo = base + premium.
const featuresCompleto = [...featuresPremium, ...featuresBase];

// Garantías de la oferta (badges de confianza).
const garantias = [
  {
    icon: ShieldCheck,
    titulo: "Calidad garantizada",
    texto: "No te entregamos tu página hasta que te guste.",
  },
  {
    icon: BadgeCheck,
    titulo: "Llave en mano",
    texto: "La construimos, publicamos y capacitamos a tu equipo.",
  },
  {
    icon: Lock,
    titulo: "Tus datos son tuyos",
    texto: "Los puedes exportar cuando quieras, sin candados.",
  },
];

// Tarifas escalonadas por número de habitaciones. La web profesional va incluida
// gratis en los tres (valor $30,000) para los hoteles fundadores. El plan
// Boutique NO incluye el agente de WhatsApp ni el pricing dinámico (premium).
const planes = [
  {
    nombre: "Boutique",
    rango: "1 a 8 habitaciones",
    precio: 1990,
    destacado: false,
    features: featuresBase,
    noIncluye: featuresPremium,
  },
  {
    nombre: "Hotel",
    rango: "9 a 20 habitaciones",
    precio: 2990,
    destacado: true,
    features: featuresCompleto,
    noIncluye: [],
  },
  {
    nombre: "Hotel grande",
    rango: "21 habitaciones o más",
    precio: 4490,
    destacado: false,
    features: featuresCompleto,
    noIncluye: [],
  },
];

export function PricingSection() {
  return (
    <section id="precios" className="py-20 sm:py-24 bg-kora-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-2">
              Precio de fundador
            </h2>
            <p className="text-kora-muted">
              Tu sitio web profesional gratis + Kora completo. Solo para los
              primeros {TOTAL_LUGARES} hoteles. Quedan{" "}
              <span className="font-bold text-kora-primary">
                {LUGARES_DISPONIBLES} de {TOTAL_LUGARES} lugares
              </span>
              .
            </p>
            <p className="mt-2 text-sm text-kora-muted">
              Estamos arrancando en {LANZAMIENTO} y solo abrimos {TOTAL_LUGARES}{" "}
              lugares fundadores.
            </p>
          </div>
        </Reveal>

        {/* Bloque-ancla: la web profesional va incluida gratis */}
        <Reveal delay={0.1}>
          <div
            id="pagina-web"
            className="card-glow relative overflow-hidden rounded-3xl bg-kora-primary p-8 sm:p-10 border-2 border-kora-primary mb-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-kora-accent text-kora-primary text-xs font-bold mb-4">
                  <Gift size={13} aria-hidden="true" />
                  Incluido gratis · valor ${VALOR_WEB.toLocaleString("es-MX")}
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Te construimos tu sitio web profesional, completo
                </h3>
                <p className="mt-3 text-white/70 text-sm sm:text-base leading-relaxed">
                  No es una plantilla: diseñamos y publicamos un sitio 100%
                  personalizado para tu hotel, con tu propio motor de reservas
                  (sin comisiones), reseñas, señales de urgencia y todas las
                  buenas prácticas. Llave en mano, sin costo de construcción.
                </p>

                <Link
                  href="/casos/paraiso-encantado"
                  className="btn-press btn-arrow mt-6 inline-flex items-center gap-2 text-kora-accent font-semibold text-sm hover:text-white transition-colors"
                >
                  Ver un ejemplo: Hotel Paraíso Encantado
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>

              <ul
                className="space-y-3 lg:border-l lg:border-white/10 lg:pl-12"
                aria-label="Lo que incluye tu sitio web profesional"
              >
                {incluyeWeb.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckCircle2
                      size={18}
                      className="flex-shrink-0 text-kora-accent mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="text-sm sm:text-base text-white/90">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        {/* Tarifas escalonadas por tamaño del hotel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {planes.map((plan, i) => (
            <Reveal key={plan.nombre} delay={0.15 + i * 0.08}>
              <div
                className={`relative h-full rounded-3xl p-8 bg-white ${
                  plan.destacado
                    ? "card-glow border-2 border-kora-primary"
                    : "card-hover border border-gray-200"
                }`}
              >
                {plan.destacado && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="animate-badge-in inline-flex items-center px-4 py-1.5 rounded-full bg-kora-accent text-kora-primary text-xs font-bold whitespace-nowrap">
                      El más elegido
                    </span>
                  </div>
                )}

                <p
                  className={`text-sm font-bold mb-1 ${
                    plan.destacado ? "text-kora-primary mt-1" : "text-kora-muted"
                  }`}
                >
                  {plan.nombre}
                </p>
                <p className="text-xs text-kora-muted">{plan.rango}</p>

                <div className="flex items-baseline gap-2 mt-3">
                  <CountUp
                    to={plan.precio}
                    prefix="$"
                    duration={1.1}
                    className={`text-4xl font-bold tabular-nums ${
                      plan.destacado ? "text-kora-primary" : "text-kora-text"
                    }`}
                  />
                  <span className="text-kora-muted">MXN/mes</span>
                </div>

                <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-kora-accent/10 px-3 py-2.5">
                  <Gift
                    size={16}
                    className="flex-shrink-0 text-kora-primary mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold text-kora-text">
                    Sitio web profesional GRATIS
                    <span className="block text-xs font-normal text-kora-muted">
                      valor ${VALOR_WEB.toLocaleString("es-MX")}
                    </span>
                  </span>
                </div>

                <ul className="mt-6 space-y-2.5" aria-label="Incluido en este plan">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2
                        size={16}
                        className="flex-shrink-0 text-kora-accent mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-kora-text">{f}</span>
                    </li>
                  ))}
                  {plan.noIncluye.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <X
                        size={16}
                        className="flex-shrink-0 text-gray-300 mt-0.5"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-gray-400 line-through">{f}</span>
                    </li>
                  ))}
                </ul>

                {plan.noIncluye.length > 0 && (
                  <p className="mt-3 text-xs text-kora-muted">
                    Disponible a partir del plan Hotel.
                  </p>
                )}

                <a
                  href="#contacto"
                  className={`btn-press btn-arrow mt-8 flex items-center justify-center gap-2 w-full py-3.5 rounded-full font-bold text-sm transition-colors text-center ${
                    plan.destacado
                      ? "btn-fill bg-kora-accent text-kora-primary hover:bg-kora-accent-dark"
                      : "border-2 border-kora-primary text-kora-primary hover:bg-kora-primary hover:text-white"
                  }`}
                >
                  Quiero ser hotel fundador
                </a>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Badges de garantía */}
        <Reveal delay={0.35}>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {garantias.map((g) => (
              <div
                key={g.titulo}
                className="flex items-start gap-3 rounded-2xl border border-kora-primary/15 bg-white px-4 py-4"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-kora-accent/15 flex items-center justify-center">
                  <g.icon size={18} className="text-kora-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-kora-text">{g.titulo}</p>
                  <p className="text-xs text-kora-muted leading-snug mt-0.5">
                    {g.texto}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.4}>
          <p className="mt-8 text-center text-xs text-kora-muted">
            Sin costo de setup ni de construcción del sitio. Permanencia mínima
            de 12 meses (así amortizamos tu sitio web sin costo). ¿No sabes tu
            tamaño? Te ayudamos a elegir.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
