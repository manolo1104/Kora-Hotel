import {
  Globe,
  MessageSquare,
  LayoutDashboard,
  Phone,
  TrendingUp,
  BarChart2,
} from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";

const modules = [
  {
    Icon: Globe,
    name: "Página web + motor de reservas",
    description: "Tu propio sitio profesional con reservas directas. Sin comisiones.",
    style: "dark" as const,
    span: 2,
  },
  {
    Icon: MessageSquare,
    name: "Agente WhatsApp con IA",
    description:
      "Responde, cotiza y cierra reservas en WhatsApp las 24 horas, aunque estés dormido.",
    style: "light" as const,
    span: 1,
  },
  {
    Icon: LayoutDashboard,
    name: "PMS - Gestión del hotel",
    description:
      "Mapa de habitaciones, check-in, check-out y housekeeping en una sola pantalla.",
    style: "accent" as const,
    span: 1,
  },
  {
    Icon: Phone,
    name: "Agente de llamadas con IA",
    description:
      "Contesta llamadas en español natural, verifica disponibilidad y toma la reserva.",
    style: "light" as const,
    span: 1,
  },
  {
    Icon: TrendingUp,
    name: "Pricing dinámico con IA",
    description:
      "El sistema sube y baja tus precios según la demanda, eventos locales y puentes.",
    style: "tint" as const,
    span: 1,
  },
  {
    Icon: BarChart2,
    name: "Dashboard + Inteligencia",
    description:
      "RevPAR, ocupación, canal de origen y forecast de 30 días. Pregúntale al sistema lo que quieras.",
    style: "dark" as const,
    span: 2,
  },
];

const styleMap = {
  dark: {
    wrapper: "bg-kora-primary",
    icon: "bg-white/15 text-kora-accent",
    name: "text-white",
    desc: "text-white/70",
  },
  light: {
    wrapper: "bg-white border border-gray-100",
    icon: "text-kora-primary",
    name: "text-kora-text",
    desc: "text-kora-muted",
  },
  accent: {
    wrapper: "bg-kora-accent",
    icon: "bg-kora-primary/10 text-kora-primary",
    name: "text-kora-primary",
    desc: "text-kora-primary/70",
  },
  tint: {
    wrapper: "bg-[#F0FDF4] border border-[#52B788]/20",
    icon: "text-kora-primary",
    name: "text-kora-text",
    desc: "text-kora-muted",
  },
};

export function SolutionSection() {
  return (
    <section id="caracteristicas" className="py-20 sm:py-24 bg-kora-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text">
              Todo lo que necesita tu hotel, en un solo lugar
            </h2>
            <p className="mt-4 text-kora-muted text-base sm:text-lg leading-relaxed">
              Sin configuraciones complicadas. Sin soporte en inglés. Sin sorpresas.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map(({ Icon, name, description, style, span }, i) => {
            const s = styleMap[style];
            const isLarge = span === 2;
            return (
              <Reveal
                key={i}
                delay={0.05 + i * 0.06}
                className={`${isLarge ? "sm:col-span-2 lg:col-span-2" : ""}`}
              >
                <div
                  className={`group card-hover ${s.wrapper} rounded-2xl p-6 h-full ${isLarge ? "sm:p-8" : ""}`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-6 ${
                      style === "dark" ? s.icon : ""
                    }`}
                    style={
                      style !== "dark"
                        ? { backgroundColor: "rgba(27, 67, 50, 0.08)" }
                        : undefined
                    }
                  >
                    <Icon
                      size={isLarge ? 22 : 20}
                      className={style === "dark" ? "text-kora-accent" : "text-kora-primary"}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className={`font-bold text-base ${isLarge ? "sm:text-lg" : ""} ${s.name} mb-2`}>
                    {name}
                  </h3>
                  <p className={`text-sm leading-relaxed ${s.desc}`}>{description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
