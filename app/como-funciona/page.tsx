import type { Metadata } from "next";
import Link from "next/link";
import {
  MessageCircle,
  Settings,
  ArrowRightLeft,
  GraduationCap,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { BarraCTA } from "@/components/shared/BarraCTA";

export const metadata: Metadata = {
  title: "Cómo funciona Kora — Onboarding en 48 horas",
  description:
    "De WhatsApp a tu primer mes operando con Kora: 5 pasos, 48 horas de setup, sin conocimientos técnicos. Así se implementa el sistema en tu hotel.",
  openGraph: { images: ["/og-image.png"] },
};

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20quiero%20empezar%20con%20Kora`;

const steps = [
  {
    num: "01",
    icon: <MessageCircle size={22} />,
    title: "Solicitas acceso por WhatsApp",
    description:
      "Nos escribes, platicamos 15 minutos sobre tu hotel y confirmamos que Kora es lo que necesitas. Si no encaja, te lo decimos con honestidad.",
    duration: "Día 1",
    detail:
      "Sin formularios largos. Sin presentaciones de ventas. Una conversación directa.",
  },
  {
    num: "02",
    icon: <Settings size={22} />,
    title: "Nosotros configuramos todo",
    description:
      "Tu equipo no toca nada. Nosotros creamos tu cuenta, configuramos los módulos, conectamos tus canales (Booking, Airbnb, Google Calendar) y ajustamos el sistema a tu hotel.",
    duration: "Días 1-2",
    detail: "Solo necesitamos tus accesos y la información de tu hotel.",
  },
  {
    num: "03",
    icon: <ArrowRightLeft size={22} />,
    title: "Migración de reservas existentes",
    description:
      "Importamos todas tus reservas actuales al nuevo PMS. Ninguna reserva se pierde. El historial de tus huéspedes llega completo.",
    duration: "Día 2",
    detail:
      "Migración desde Excel, Google Sheets, tu PMS anterior o manual. Sin importar de dónde vengan.",
  },
  {
    num: "04",
    icon: <GraduationCap size={22} />,
    title: "Capacitación de 30 minutos",
    description:
      "Video llamada con tu equipo antes de arrancar. Mostramos las funciones que usarán día a día: check-in, mapa de habitaciones y cómo ver las reservas que lleguen.",
    duration: "Día 2-3",
    detail:
      "Grabamos la sesión para que puedas compartirla con tu equipo cuando entre alguien nuevo.",
  },
  {
    num: "05",
    icon: <Rocket size={22} />,
    title: "Primer mes operando con soporte activo",
    description:
      "Arrancas con soporte directo por WhatsApp. Cualquier duda, ajuste o configuración adicional la atendemos en horas. Al final del primer mes revisamos juntos los resultados.",
    duration: "Días 3-30",
    detail:
      "El primer mes es el más importante. Estamos contigo en cada paso.",
  },
];

export default function ComoFuncionaPage() {
  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="py-20 sm:py-28 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
            Proceso de implementación
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            De WhatsApp a operar
            <br />
            en 48 horas
          </h1>
          <p className="mt-6 text-white/70 text-lg leading-relaxed max-w-xl mx-auto">
            Sin conocimientos técnicos. Sin instalar nada. Tu equipo solo
            necesita saber usar el celular.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 sm:py-24 bg-kora-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-[22px] top-10 bottom-10 w-px bg-kora-primary/15 hidden sm:block"
              aria-hidden="true"
            />

            <ol className="space-y-10">
              {steps.map((step, i) => (
                <li key={i} className="relative flex gap-6 sm:gap-8">
                  {/* Step number bubble */}
                  <div className="flex-shrink-0 relative z-10">
                    <div className="w-11 h-11 rounded-full bg-kora-primary flex items-center justify-center text-white shadow-md">
                      {step.icon}
                    </div>
                  </div>

                  <div className="pb-2 flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-xs font-bold text-kora-muted uppercase tracking-widest">
                        {step.num}
                      </span>
                      <span className="text-xs font-semibold text-kora-accent bg-kora-accent/10 px-2.5 py-0.5 rounded-full">
                        {step.duration}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-kora-text mb-2">
                      {step.title}
                    </h2>
                    <p className="text-sm sm:text-base text-kora-muted leading-relaxed mb-2">
                      {step.description}
                    </p>
                    <p className="text-xs text-kora-primary/70 font-medium">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Guarantees */}
      <section className="py-14 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-kora-text text-center mb-10">
            Lo que garantizamos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                title: "Setup en 48 horas",
                desc: "O te devolvemos el primer mes sin preguntas.",
              },
              {
                title: "Sin comisiones ocultas",
                desc: "$2,990 MXN/mes es todo lo que pagas. Sin sorpresas de activación ni de uso.",
              },
              {
                title: "Soporte humano en español",
                desc: "Acceso directo a WhatsApp del equipo, no a un bot de soporte.",
              },
            ].map((g) => (
              <div
                key={g.title}
                className="bg-kora-bg rounded-2xl p-6 border border-gray-100"
              >
                <p className="font-bold text-kora-primary text-base mb-2">
                  {g.title}
                </p>
                <p className="text-sm text-kora-muted leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Primer día operando */}
      <section className="py-14 sm:py-20 bg-kora-bg border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-kora-text mb-3">
              Así se ve tu primera semana con Kora
            </h2>
            <p className="text-kora-muted text-sm max-w-lg mx-auto">
              Lo que cambia no es solo la tecnología — es lo que haces y no haces cada día.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sin Kora */}
            <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
              <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-5">
                Sin Kora
              </p>
              <div className="space-y-5">
                {[
                  {
                    time: "8:00 AM",
                    desc: "Abres Booking, Airbnb, WhatsApp y revisas las llamadas perdidas de la noche. 20 minutos solo para ver qué pasó.",
                  },
                  {
                    time: "11:30 PM",
                    desc: "Un huésped escribe preguntando disponibilidad para el fin de semana. Nadie contesta. Al día siguiente ya reservó en otro lado.",
                  },
                  {
                    time: "Fin de mes",
                    desc: "¿Cuánto pagaste en comisiones a las OTAs? No lo sabes exactamente. Tienes que juntar los datos de 3 canales distintos.",
                  },
                ].map((item) => (
                  <div key={item.time} className="flex gap-3">
                    <span className="text-xs font-bold text-red-400 flex-shrink-0 w-16 pt-0.5">
                      {item.time}
                    </span>
                    <p className="text-sm text-red-800/80 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Con Kora */}
            <div className="bg-kora-primary rounded-2xl p-6">
              <p className="text-xs font-bold text-kora-accent uppercase tracking-widest mb-5">
                Con Kora
              </p>
              <div className="space-y-5">
                {[
                  {
                    time: "8:00 AM",
                    desc: "Recibes el reporte diario automático: ocupación, check-ins programados y reservas nuevas que llegaron mientras dormías.",
                  },
                  {
                    time: "11:30 PM",
                    desc: "El agente de IA responde, muestra disponibilidad y cierra la reserva directamente por WhatsApp. Tú duermes. La reserva llega.",
                  },
                  {
                    time: "Fin de mes",
                    desc: "El dashboard muestra todo: OTAs vs directo, comisiones pagadas, RevPAR, ahorro acumulado. Un solo número por semana.",
                  },
                ].map((item) => (
                  <div key={item.time} className="flex gap-3">
                    <span className="text-xs font-bold text-kora-accent flex-shrink-0 w-16 pt-0.5">
                      {item.time}
                    </span>
                    <p className="text-sm text-white/80 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-kora-text mb-4">
            Empezamos esta semana
          </h2>
          <p className="text-kora-muted mb-8">
            Escríbenos hoy y el jueves ya tienes el sistema funcionando.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              Empezar ahora por WhatsApp
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <Link
              href="/precios"
              className="inline-flex items-center justify-center px-8 py-4 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
            >
              Ver precios
            </Link>
          </div>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
