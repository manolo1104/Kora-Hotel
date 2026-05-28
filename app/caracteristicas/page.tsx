import type { Metadata } from "next";
import Link from "next/link";
import {
  Globe,
  MessageCircle,
  LayoutDashboard,
  Phone,
  TrendingUp,
  BarChart2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { TiltCard } from "@/components/shared/TiltCard";
import {
  ReservaMockup,
  WhatsAppMockup,
  PMSMockup,
  LlamadasMockup,
  PricingMockup,
  DashboardMockup,
} from "@/components/caracteristicas/Mockups";

export const metadata: Metadata = {
  title: "Características — Kora",
  description:
    "Motor de reservas directo, agente WhatsApp con IA, PMS, agente de llamadas, pricing dinámico y dashboard. El sistema todo-en-uno para hoteles boutique en México.",
};

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20quiero%20ver%20el%20demo%20de%20Kora`;

// ─── Module section ───────────────────────────────────────────────────────────

interface ModuleSectionProps {
  id: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  bullets: string[];
  mockup: React.ReactNode;
  reverse?: boolean;
  dark?: boolean;
}

function ModuleSection({
  id,
  icon,
  tag,
  title,
  description,
  bullets,
  mockup,
  reverse = false,
  dark = false,
}: ModuleSectionProps) {
  return (
    <section
      id={id}
      className={`py-16 sm:py-20 ${dark ? "bg-kora-primary" : "bg-white"}`}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center ${reverse ? "lg:[&>*:first-child]:order-last" : ""}`}
        >
          <Reveal direction={reverse ? "right" : "left"}>
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${dark ? "bg-kora-accent/20" : "bg-kora-primary/8"}`}
              >
                <span className={dark ? "text-kora-accent" : "text-kora-primary"}>
                  {icon}
                </span>
              </div>
              <span
                className={`text-xs font-bold uppercase tracking-widest ${dark ? "text-kora-accent" : "text-kora-muted"}`}
              >
                {tag}
              </span>
            </div>
            <h2
              className={`text-2xl sm:text-3xl font-bold tracking-tight leading-tight mb-4 ${dark ? "text-white" : "text-kora-text"}`}
            >
              {title}
            </h2>
            <p
              className={`text-sm sm:text-base leading-relaxed mb-6 ${dark ? "text-white/70" : "text-kora-muted"}`}
            >
              {description}
            </p>
            <ul className="space-y-2.5">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={16}
                    className={`flex-shrink-0 mt-0.5 ${dark ? "text-kora-accent" : "text-kora-accent"}`}
                  />
                  <span
                    className={`text-sm leading-snug ${dark ? "text-white/80" : "text-kora-text"}`}
                  >
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal direction={reverse ? "left" : "right"} delay={0.1}>
            <TiltCard className="rounded-2xl" glare={dark}>
              {mockup}
            </TiltCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CaracteristicasPage() {
  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="py-20 sm:py-28 bg-kora-bg border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-kora-text leading-tight">
              Todo lo que incluye Kora
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 text-kora-muted text-lg leading-relaxed max-w-2xl mx-auto">
              Seis módulos integrados que reemplazan seis herramientas distintas.
              Un solo pago, una sola pantalla, cero comisiones.
            </p>
          </Reveal>
          <Reveal delay={0.22}>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Ver demo en vivo
                <ArrowRight size={16} aria-hidden="true" />
              </a>
              <Link
                href="/precios"
                className="btn-press inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
              >
                Ver precios
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Module 1 */}
      <ModuleSection
        id="motor-reservas"
        icon={<Globe size={18} />}
        tag="Módulo 1"
        title="Motor de reservas directo"
        description="Tu propio sistema de reservas en línea, conectado a tu sitio web. Los huéspedes reservan y pagan sin pasar por Booking ni Airbnb — y tú te quedas con el 100% del pago."
        bullets={[
          "Disponibilidad y precios en tiempo real",
          "Pagos integrados con Stripe o Conekta",
          "Confirmación automática al huésped por email y WhatsApp",
          "Widget embebible en tu sitio web actual",
        ]}
        mockup={<ReservaMockup />}
      />

      {/* Module 2 */}
      <ModuleSection
        id="agente-whatsapp"
        icon={<MessageCircle size={18} />}
        tag="Módulo 2"
        title="Agente WhatsApp con IA"
        description="Un agente de inteligencia artificial que responde WhatsApps de huéspedes las 24 horas, en español perfecto, y cierra reservas completas sin que intervenga tu equipo."
        bullets={[
          "Responde consultas de disponibilidad y precio al instante",
          "Envía links de pago directo dentro de la conversación",
          "Manda recordatorios de llegada y salida automáticamente",
          "Escala al equipo humano cuando el huésped lo necesita",
        ]}
        mockup={<WhatsAppMockup />}
        reverse
        dark
      />

      {/* Module 3 */}
      <ModuleSection
        id="pms"
        icon={<LayoutDashboard size={18} />}
        tag="Módulo 3"
        title="PMS — Sistema de gestión"
        description="El corazón operativo de tu hotel: mapa de habitaciones en tiempo real, check-in y check-out digital, y housekeeping coordinado desde una sola pantalla."
        bullets={[
          "Mapa visual de habitaciones con estado en tiempo real",
          "Check-in y check-out digitalizados en segundos",
          "Asignación y seguimiento de housekeeping",
          "Historial completo de cada huésped",
        ]}
        mockup={<PMSMockup />}
      />

      {/* Module 4 */}
      <ModuleSection
        id="agente-llamadas"
        icon={<Phone size={18} />}
        tag="Módulo 4"
        title="Agente de llamadas con IA"
        description="Ninguna llamada perdida. El agente contesta en español, responde preguntas, cotiza disponibilidad y transfiere los datos directamente al PMS para cerrar la reserva."
        bullets={[
          "Contesta llamadas las 24 horas, incluso de madrugada",
          "Voz natural en español, sin sonido robótico",
          "Guarda el resumen de cada llamada en el CRM",
          "Transfiere a un humano cuando el caso lo requiere",
        ]}
        mockup={<LlamadasMockup />}
        reverse
        dark
      />

      {/* Module 5 */}
      <ModuleSection
        id="pricing-dinamico"
        icon={<TrendingUp size={18} />}
        tag="Módulo 5"
        title="Pricing dinámico con IA"
        description="Kora ajusta tus tarifas automáticamente según ocupación, temporada, puentes y eventos locales. Sin que tengas que hacer nada. Sin contratar un revenue manager."
        bullets={[
          "Detecta fines de semana y puentes antes que tú",
          "Sube precios cuando la demanda lo justifica",
          "Nunca vende por debajo de tu tarifa mínima",
          "Maximiza el RevPAR mes a mes",
        ]}
        mockup={<PricingMockup />}
      />

      {/* Module 6 */}
      <ModuleSection
        id="dashboard"
        icon={<BarChart2 size={18} />}
        tag="Módulo 6"
        title="Dashboard y métricas"
        description="Un solo lugar para ver qué está pasando con tu hotel: ocupación real, ingresos por canal, forecast a 30 días y todas las métricas que importan, sin hojas de Excel."
        bullets={[
          "Ocupación, RevPAR y ADR en tiempo real",
          "Forecast de ocupación e ingresos a 30 días",
          "Desglose de reservas por canal (directo vs OTA)",
          "Exportación de reportes mensuales en PDF",
        ]}
        mockup={<DashboardMockup />}
        reverse
        dark
      />

      {/* CTA demo */}
      <section className="py-16 sm:py-20 bg-kora-bg border-t border-gray-100">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-kora-text mb-4">
            ¿Quieres verlo en vivo?
          </h2>
          <p className="text-kora-muted text-base mb-8">
            Te mostramos el sistema completo en una llamada de 20 minutos,
            adaptado a tu hotel.
          </p>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Solicitar demo por WhatsApp
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
