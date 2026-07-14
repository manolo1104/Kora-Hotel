import Link from "next/link";
import { CheckCircle2, ArrowRight, ShieldCheck, BadgeCheck, Lock } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CountUp } from "@/components/shared/CountUp";
import { GlowCard } from "@/components/shared/GlowCard";
import { CtaLink } from "@/components/shared/CtaLink";
import { PLANES } from "@/lib/oferta";

// Lo que incluye el sitio web profesional que construimos (el gancho gratis).
const incluyeWeb = [
  "Diseño 100% personalizado para tu hotel (no plantillas)",
  "Motor de reservas directo, sin comisiones",
  "Reseñas y social proof de tus huéspedes",
  "Señales de urgencia (pocas habitaciones, alta demanda)",
  "Tu dominio propio, hosting y certificado SSL",
  "Lo construimos, publicamos y te capacitamos",
];

// Plan único ($550): todo incluido, con habitaciones ilimitadas.
const featuresKora = [
  "Motor de reservas directo, 0% de comisión",
  "Habitaciones ilimitadas",
  "PMS completo: check-in/out y housekeeping",
  "Camila: agente de WhatsApp con IA, 24/7",
  "Dashboard con métricas y forecast de 30 días",
  "CRM de huéspedes y emails automáticos",
  "Mini-página de reservas y cobro con tarjeta",
  "Soporte directo con el equipo fundador",
];

// Garantías de la oferta (badges de confianza).
const garantias = [
  {
    icon: ShieldCheck,
    titulo: "30 días gratis, sin tarjeta",
    texto:
      "Carga tu hotel y usa Kora completo un mes sin dar ningún dato de pago. Activas tu plan solo si te convence.",
  },
  {
    icon: BadgeCheck,
    titulo: "Cancelas tú mismo, en un clic",
    texto:
      "Desde tu panel, sin llamadas ni correos ni penalización. Mes a mes, sin permanencia.",
  },
  {
    icon: Lock,
    titulo: "Tus datos son tuyos",
    texto: "Los puedes exportar cuando quieras, sin candados.",
  },
];

// Arranque "llave en mano": los bonos que van GRATIS con el plan (valor en pesos
// justificable). Cada uno mata una objeción real del hotelero.
const arranque = [
  { titulo: "Arranque Llave en Mano (48h)", detalle: "Cargamos cuartos, fotos, tarifas y tu motor", valor: 8000 },
  { titulo: "Tu página de reservas lista", detalle: "Motor embebido en una página con tu marca", valor: 6000 },
  { titulo: "Camila entrenada con tu hotel", detalle: "Tus precios, políticas y respuestas", valor: 4000 },
  { titulo: "Migración + sync Booking/Airbnb", detalle: "Sin overbooking, sin líos", valor: 2500 },
  { titulo: "2 meses de acompañamiento 1-a-1", detalle: "Con el equipo fundador", valor: 3000 },
];
const arranqueTotal = arranque.reduce((s, b) => s + b.valor, 0);

// Plan único (fuente única: lib/oferta.ts): todo incluido, sin límite de
// habitaciones.
const planes = PLANES.map((p) => ({
  ...p,
  features: featuresKora,
}));

export function PricingSection() {
  return (
    <section id="precios" className="section-divider py-20 sm:py-24 bg-kora-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-2">
              Precios
            </h2>
            <p className="text-kora-muted">
              Un solo plan, todo incluido y con habitaciones ilimitadas.{" "}
              <span className="font-bold text-kora-primary">
                Plan mes a mes, sin permanencia.
              </span>
            </p>
            <p className="mt-2 text-sm text-kora-muted">
              Pruébalo 30 días gratis, <span className="font-semibold text-kora-text">sin tarjeta</span>:
              cargas tu hotel y lo usas todo. Activas tu plan solo si te convence.
            </p>
            {/* Urgencia REAL (capacidad de acompañamiento, no falso countdown) */}
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-kora-accent/15 px-4 py-2 text-xs font-semibold text-kora-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-kora-accent animate-pulse" aria-hidden="true" />
              Solo tomamos 5 hoteles nuevos al mes: montamos cada uno a mano
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
                  Servicio opcional · cotización a tu medida
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Te creamos tu sitio web profesional, completo
                </h3>
                <p className="mt-3 text-white/70 text-sm sm:text-base leading-relaxed">
                  No es una plantilla: un sitio 100% personalizado con tu motor
                  de reservas propio, sin comisiones. Llave en mano; lo cotizamos
                  según tu hotel, aparte de tu mensualidad.
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

        {/* Arranque Reservas Directas: el stack de valor que va GRATIS con el plan */}
        <Reveal delay={0.12}>
          <div className="max-w-2xl mx-auto mb-8 rounded-3xl border-2 border-kora-primary/15 bg-white p-6 sm:p-8">
            <div className="text-center mb-5">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-kora-primary/8 text-kora-primary text-xs font-bold">
                Arranque Reservas Directas · llave en mano
              </span>
              <p className="mt-3 text-sm text-kora-muted">
                Al activar tu plan, montamos todo por ti. Estos servicios de arranque
                van <span className="font-semibold text-kora-text">incluidos gratis:</span>
              </p>
            </div>
            <ul className="divide-y divide-gray-100">
              {arranque.map((b) => (
                <li key={b.titulo} className="flex items-baseline justify-between gap-3 py-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 size={16} className="flex-shrink-0 text-kora-accent mt-1" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-kora-text">{b.titulo}</p>
                      <p className="text-xs text-kora-muted">{b.detalle}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-kora-muted tabular-nums whitespace-nowrap line-through">
                    ${b.valor.toLocaleString("es-MX")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-kora-primary px-5 py-4 text-white">
              <span className="text-sm">
                Valor del arranque:{" "}
                <span className="line-through text-white/60">${arranqueTotal.toLocaleString("es-MX")}</span>
              </span>
              <span className="text-lg font-bold text-kora-accent">Gratis</span>
            </div>
          </div>
        </Reveal>

        {/* Garantía que revierte el riesgo (la palanca #1 de la oferta) */}
        <Reveal delay={0.14}>
          <div className="max-w-2xl mx-auto mb-8 flex items-start gap-4 rounded-3xl border-2 border-kora-accent/40 bg-kora-accent/8 p-5 sm:p-6">
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-kora-accent/25 flex items-center justify-center">
              <ShieldCheck size={22} className="text-kora-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-bold text-kora-text">Garantía Reservas Directas</p>
              <p className="mt-1 text-sm text-kora-muted leading-relaxed">
                Pruébalo 30 días gratis, sin tarjeta. Y si en 60 días de usar Kora activo
                no recuperas tu mensualidad en comisiones ahorradas,{" "}
                <span className="font-semibold text-kora-text">seguimos trabajando gratis hasta que lo logres.</span>
              </p>
            </div>
          </div>
        </Reveal>

        {/* Plan único: todo incluido, habitaciones ilimitadas */}
        <div className="max-w-md mx-auto">
          {planes.map((plan, i) => (
            <Reveal
              key={plan.nombre}
              delay={0.15 + i * 0.08}
            >
              <GlowCard
                className={`relative h-full rounded-3xl p-8 bg-white ${
                  plan.destacado
                    ? "card-glow border-2 border-kora-primary lg:scale-[1.04] shadow-xl shadow-kora-primary/15"
                    : "card-hover border border-gray-200"
                }`}
              >
                {plan.destacado && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="animate-badge-in inline-flex items-center px-4 py-1.5 rounded-full bg-kora-accent text-kora-primary text-xs font-bold whitespace-nowrap">
                      Todo incluido
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
                {/* Transparencia tipo Stripe: la cuenta anual sin letras chiquitas */}
                <p className="mt-1 text-[11px] text-kora-muted tabular-nums">
                  ${plan.precio.toLocaleString("es-MX")} × 12 = $
                  {(plan.precio * 12).toLocaleString("es-MX")} al año
                </p>
                {plan.destacado && (
                  <a
                    href="#calculadora"
                    className="mt-2 inline-block text-xs font-semibold text-kora-primary underline decoration-kora-accent underline-offset-2 hover:text-kora-primary-dark transition-colors"
                  >
                    ↑ Calcula cuánto recuperas con tu hotel
                  </a>
                )}

                <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-kora-accent/10 px-3 py-2.5">
                  <CheckCircle2
                    size={16}
                    className="flex-shrink-0 text-kora-primary mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold text-kora-text">
                    Mes a mes, sin permanencia
                    <span className="block text-xs font-normal text-kora-muted">
                      cancelas cuando quieras
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
                </ul>

                <CtaLink
                  href="/panel/onboarding"
                  ctaName="precios_onboarding"
                  className={`btn-press btn-arrow mt-8 flex items-center justify-center gap-2 w-full py-3.5 rounded-full font-bold text-sm transition-colors text-center ${
                    plan.destacado
                      ? "btn-fill bg-kora-accent text-kora-primary hover:bg-kora-accent-dark"
                      : "border-2 border-kora-primary text-kora-primary hover:bg-kora-primary hover:text-white"
                  }`}
                >
                  Empezar gratis — sin tarjeta
                </CtaLink>
                <p className="mt-2 text-center text-[11px] text-kora-muted">
                  30 días completos · cancelas tú mismo en un clic, desde tu panel
                </p>
                {/* Social proof real: el sistema opera un hotel de verdad hoy */}
                <p className="mt-3 text-center text-[11px] text-kora-muted">
                  El mismo sistema que opera las reservas reales de{" "}
                  <Link
                    href="/casos/paraiso-encantado"
                    className="font-semibold text-kora-primary underline decoration-kora-accent underline-offset-2 hover:text-kora-primary-dark"
                  >
                    Hotel Paraíso Encantado
                  </Link>
                </p>
                <CtaLink
                  href={`/pago/iniciar?plan=${plan.clave}`}
                  ctaName="precios_pago"
                  className="btn-press btn-arrow mt-2 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-kora-primary underline decoration-kora-accent underline-offset-2 hover:text-kora-primary-dark transition-colors"
                >
                  ¿Ya lo probaste? Activa tu plan de una vez
                  <ArrowRight size={13} aria-hidden="true" />
                </CtaLink>
              </GlowCard>
            </Reveal>
          ))}
        </div>

        {/* Sello de pagos seguros (Stripe) — visible junto a los CTAs, también en móvil */}
        <Reveal delay={0.3}>
          <div className="mt-8 flex items-center justify-center gap-2.5 text-kora-muted">
            <Lock size={14} className="text-kora-primary" aria-hidden="true" />
            <span className="text-xs font-medium">Cobro mensual seguro con</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/integraciones/stripe.svg" alt="Stripe" className="h-5 w-auto opacity-80" />
          </div>
        </Reveal>

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

        <Reveal delay={0.44}>
          <p className="mt-6 text-center text-xs text-kora-muted">
            Plan mes a mes, sin permanencia: cancelas cuando quieras y exportas
            tus datos. El sitio web es un servicio aparte (cotización
            personalizada). ¿No sabes tu tamaño? Te ayudamos a elegir.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
