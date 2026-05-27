import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { BarraCTA } from "@/components/shared/BarraCTA";

export const metadata: Metadata = {
  title: "Características — Kora",
  description:
    "Descubre todo lo que incluye Kora: motor de reservas, agente WhatsApp IA, PMS, pricing dinámico y más. El sistema todo-en-uno para hoteles boutique en México.",
};

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20las%20caracter%C3%ADsticas%20de%20Kora`;

export default function CaracteristicasPage() {
  return (
    <main className="pt-16">
      <section className="min-h-[60vh] flex items-center bg-kora-bg py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-kora-text leading-tight">
            Todo lo que incluye Kora
          </h1>
          <p className="mt-5 text-kora-muted text-lg leading-relaxed max-w-xl mx-auto">
            Página en construcción. Mientras tanto escríbenos por WhatsApp y te
            mostramos el sistema en vivo.
          </p>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#25D366] text-white font-semibold text-sm hover:bg-[#1da851] transition-colors"
          >
            Escríbenos por WhatsApp
            <ArrowRight size={16} aria-hidden="true" />
          </a>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              {
                title: "Motor de reservas directo",
                desc: "Tu propio sitio con reservas sin comisiones.",
              },
              {
                title: "Agente WhatsApp con IA",
                desc: "Responde y cierra reservas las 24 horas.",
              },
              {
                title: "PMS + Dashboard",
                desc: "Gestión de habitaciones, métricas y forecast.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-6 border border-gray-100"
              >
                <h3 className="font-bold text-kora-text text-base">{item.title}</h3>
                <p className="mt-2 text-sm text-kora-muted leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-xs text-kora-muted">
            TODO: Agregar descripción detallada de cada módulo con capturas del
            sistema.
          </p>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
