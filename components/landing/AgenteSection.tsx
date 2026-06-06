import { Clock, MessageSquare, Languages, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { WhatsAppMockup } from "@/components/landing/ProductMockups";

// Momento dedicado al agente de WhatsApp (estilo Notion: "el turno de noche").
// Fondo oscuro para dar ritmo claro/oscuro a la página.

const puntos = [
  {
    Icon: Clock,
    title: "Responde en segundos, 24/7",
    desc: "Mientras duermes, atiende cada WhatsApp al instante. El huésped ya no se va a Booking.",
  },
  {
    Icon: MessageSquare,
    title: "Cotiza y cierra la reserva sola",
    desc: "Da precios, manda el link de pago y confirma la reserva sin que muevas un dedo.",
  },
  {
    Icon: Languages,
    title: "En español natural",
    desc: "Habla como tu mejor recepcionista. El huésped ni nota que es una IA.",
  },
];

export function AgenteSection() {
  return (
    <section id="agente" className="py-20 sm:py-24 bg-kora-primary scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Texto */}
          <Reveal direction="left">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-kora-accent mb-4">
                Agente de WhatsApp con IA
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                Tu recepcionista que nunca duerme
              </h2>
              <p className="mt-4 text-white/70 text-base sm:text-lg leading-relaxed max-w-lg">
                Muchos huéspedes escriben de noche o en fin de semana, cuando nadie
                contesta. Camila responde por ti —a cualquier hora— y convierte esos
                mensajes en reservas pagadas.
              </p>

              <ul className="mt-8 space-y-5">
                {puntos.map(({ Icon, title, desc }) => (
                  <li key={title} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-kora-accent/20 flex items-center justify-center">
                      <Icon size={18} className="text-kora-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{title}</p>
                      <p className="text-sm text-white/60 leading-relaxed mt-0.5">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#contacto"
                  className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
                >
                  Solicitar mi demo
                  <ArrowRight size={16} />
                </a>
                <span className="text-xs text-white/50">Disponible desde el plan Hotel</span>
              </div>
            </div>
          </Reveal>

          {/* Chat en vivo */}
          <Reveal direction="right" delay={0.1}>
            <div className="max-w-sm mx-auto w-full">
              <WhatsAppMockup />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
