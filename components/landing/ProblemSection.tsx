import { PhoneOff, Percent, FileSpreadsheet, BarChart3 } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";

const pains = [
  {
    Icon: PhoneOff,
    text: "Tu WhatsApp suena a las 11 PM. Nadie contesta. El huésped reserva en Booking.",
  },
  {
    Icon: Percent,
    text: "Pagas 18% de comisión en cada reserva. Booking gana más que tú.",
  },
  {
    Icon: FileSpreadsheet,
    text: "Llevas las reservas en Excel o en un cuaderno. Un error y hay overbooking.",
  },
  {
    Icon: BarChart3,
    text: "No sabes qué habitación es más rentable ni cuándo subir el precio.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-12 text-center">
            ¿Te suena familiar?
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-3xl mx-auto lg:max-w-none">
          {pains.map(({ Icon, text }, i) => (
            <Reveal key={i} delay={0.06 + i * 0.07}>
              <div className="group card-hover flex gap-4 p-5 sm:p-6 rounded-2xl border border-gray-100 bg-white shadow-sm h-full">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:rotate-6"
                  style={{ backgroundColor: "rgba(27, 67, 50, 0.08)" }}
                >
                  <Icon size={20} className="text-kora-primary" aria-hidden="true" />
                </div>
                <p className="text-kora-text text-sm sm:text-base leading-relaxed">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
