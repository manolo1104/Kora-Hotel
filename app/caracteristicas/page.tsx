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

export const metadata: Metadata = {
  title: "Características — Kora",
  description:
    "Motor de reservas directo, agente WhatsApp con IA, PMS, agente de llamadas, pricing dinámico y dashboard. El sistema todo-en-uno para hoteles boutique en México.",
  openGraph: { images: ["/og-image.png"] },
};

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20quiero%20ver%20el%20demo%20de%20Kora`;

// ─── Module mockups ───────────────────────────────────────────────────────────

function ReservaMockup() {
  return (
    <div className="bg-kora-primary rounded-2xl p-5 shadow-xl">
      <p className="text-kora-accent text-[10px] font-bold uppercase tracking-widest mb-3">
        Motor de reservas
      </p>
      <div className="bg-white rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold text-kora-text">Check-in</p>
          <span className="text-xs bg-kora-bg border border-gray-200 rounded-lg px-3 py-1.5 text-kora-text">
            Vie 6 jun
          </span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold text-kora-text">Check-out</p>
          <span className="text-xs bg-kora-bg border border-gray-200 rounded-lg px-3 py-1.5 text-kora-text">
            Dom 8 jun
          </span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs font-semibold text-kora-text">Habitación</p>
          <span className="text-xs bg-kora-bg border border-gray-200 rounded-lg px-3 py-1.5 text-kora-text">
            Suite Jardín
          </span>
        </div>
        <div className="pt-1">
          <div className="w-full py-2.5 rounded-full bg-kora-accent text-center text-xs font-bold text-kora-primary">
            Reservar ahora — $2,400 MXN
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppMockup() {
  return (
    <div className="bg-[#111B21] rounded-2xl p-4 shadow-xl max-w-xs mx-auto">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-3">
        <div className="w-7 h-7 rounded-full bg-kora-accent flex items-center justify-center">
          <MessageCircle size={13} className="text-kora-primary" />
        </div>
        <div>
          <p className="text-white text-xs font-semibold leading-none">
            Kora · Hotel Paraíso
          </p>
          <p className="text-[#00A884] text-[10px] mt-0.5">en línea</p>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-end">
          <div className="bg-[#005C4B] text-white text-xs rounded-xl rounded-tr-sm px-3 py-2 max-w-[80%]">
            Hola, ¿tienen cuarto para este fin de semana?
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-[#202C33] text-white text-xs rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
            Hola! Si, tenemos la Suite Jardín y la Cabaña Huasteca disponibles.
            ¿Cuántas noches?
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-[#005C4B] text-white text-xs rounded-xl rounded-tr-sm px-3 py-2 max-w-[80%]">
            2 noches, viernes y sábado
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-[#202C33] text-white text-xs rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
            Perfecto. La Suite Jardín queda en $2,400/noche. Te mando el link
            de pago directo ahora.
          </div>
        </div>
      </div>
    </div>
  );
}

function PMSMockup() {
  const habitaciones = [
    { num: "101", estado: "libre", nombre: "Std Norte" },
    { num: "102", estado: "ocupada", nombre: "Std Sur" },
    { num: "103", estado: "limpieza", nombre: "Std Vista" },
    { num: "201", estado: "libre", nombre: "Suite Jardín" },
    { num: "202", estado: "ocupada", nombre: "Suite Patio" },
    { num: "301", estado: "libre", nombre: "Cabaña" },
  ];
  const color: Record<string, string> = {
    libre: "bg-kora-accent/20 text-kora-primary border-kora-accent/40",
    ocupada: "bg-kora-primary text-white border-kora-primary",
    limpieza: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <div className="bg-white rounded-2xl p-5 shadow-xl border border-gray-100">
      <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-4">
        Mapa de habitaciones
      </p>
      <div className="grid grid-cols-3 gap-2">
        {habitaciones.map((h) => (
          <div
            key={h.num}
            className={`border rounded-xl p-2.5 text-center ${color[h.estado]}`}
          >
            <p className="text-base font-bold leading-none">{h.num}</p>
            <p className="text-[9px] mt-1 leading-tight opacity-80">
              {h.nombre}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3 text-[10px] text-kora-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-kora-accent" />
          Libre
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-kora-primary" />
          Ocupada
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          Limpieza
        </span>
      </div>
    </div>
  );
}

function LlamadasMockup() {
  return (
    <div className="bg-kora-primary rounded-2xl p-5 shadow-xl">
      <p className="text-kora-accent text-[10px] font-bold uppercase tracking-widest mb-4">
        Agente de llamadas activo
      </p>
      <div className="space-y-3">
        {[
          {
            hora: "09:14",
            tipo: "Reserva",
            desc: "Suite Jardín · 3 noches · confirmada",
            ok: true,
          },
          {
            hora: "11:42",
            tipo: "Consulta",
            desc: "Precio fin de semana · cotización enviada",
            ok: true,
          },
          {
            hora: "14:07",
            tipo: "Reserva",
            desc: "Habitación Std · pendiente de pago",
            ok: false,
          },
          {
            hora: "16:55",
            tipo: "Reserva",
            desc: "Cabaña Huasteca · 2 noches · confirmada",
            ok: true,
          },
        ].map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 bg-white/10 rounded-xl p-3"
          >
            <div
              className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.ok ? "bg-kora-accent" : "bg-amber-400"}`}
            />
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold">
                {item.tipo}{" "}
                <span className="font-normal text-white/50">{item.hora}</span>
              </p>
              <p className="text-white/60 text-[10px] mt-0.5 leading-tight">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingMockup() {
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  const prices = [980, 1050, 1020, 1100, 1450, 1800, 1650];
  const max = Math.max(...prices);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-xl border border-gray-100">
      <div className="flex justify-between items-baseline mb-4">
        <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
          Pricing esta semana
        </p>
        <span className="text-xs font-bold text-kora-accent">+18% RevPAR</span>
      </div>
      <div className="flex items-end gap-1.5 h-24">
        {days.map((day, i) => (
          <div key={day} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-md ${i >= 4 ? "bg-kora-primary" : "bg-kora-accent/40"}`}
              style={{ height: `${(prices[i] / max) * 100}%` }}
            />
            <span className="text-[9px] text-kora-muted font-medium">{day}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-kora-muted leading-tight">
        Finde detectado · precios ajustados automáticamente
      </p>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-xl border border-gray-100">
      <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest mb-4">
        Dashboard — Mayo 2026
      </p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: "Ocupación", value: "74%", color: "text-kora-primary" },
          { label: "RevPAR", value: "$892", color: "text-kora-primary" },
          { label: "ADR", value: "$1,205", color: "text-kora-text" },
          { label: "Res. directas", value: "61%", color: "text-kora-accent" },
        ].map((m) => (
          <div key={m.label} className="bg-kora-bg rounded-xl p-3">
            <p className="text-[9px] text-kora-muted uppercase tracking-wide">
              {m.label}
            </p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 ${m.color}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>
      <div className="bg-kora-accent/10 rounded-xl p-3">
        <p className="text-[10px] font-semibold text-kora-primary">
          Forecast 30 días
        </p>
        <p className="text-xs text-kora-muted mt-0.5">
          Ocupación proyectada: 79% · Ingresos: $312,400 MXN
        </p>
      </div>
    </div>
  );
}

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
          <div>
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
          </div>
          <div>{mockup}</div>
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
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-kora-text leading-tight">
            Todo lo que incluye Kora
          </h1>
          <p className="mt-5 text-kora-muted text-lg leading-relaxed max-w-2xl mx-auto">
            Seis módulos integrados que reemplazan seis herramientas distintas.
            Un solo pago, una sola pantalla, cero comisiones.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              Ver demo en vivo
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <Link
              href="/precios"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
            >
              Ver precios
            </Link>
          </div>
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
