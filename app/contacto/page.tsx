import type { Metadata } from "next";
import { MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/landing/ContactForm";
import { Reveal } from "@/components/shared/Reveal";
import { IMPLEMENTACION_HORAS } from "@/lib/oferta";

// Por qué existe esta página:
//
// Los 14 botones de las herramientas gratis, los CTA del blog, el panel y el
// motor apuntaban todos al ancla `#contacto` — dentro de una landing de
// 16.000 px. Y el ancla NO LLEVABA AL FORMULARIO: la landing anima cada sección
// al entrar en pantalla, así que bajar hace CRECER lo que queda arriba y el
// destino se aleja más rápido de lo que uno se acerca (medido: 14.000 px
// después de ocho segundos reintentando). No tiene arreglo desde el navegador
// mientras el contenido mida distinto según lo que se haya visto.
//
// El hotelero que acababa de calcular cuánto le cuesta Booking pulsaba "Quiero
// dejar de pagar esto" y aterrizaba arriba de la landing, sin formulario a la
// vista y sin saber por qué. Aquí el formulario es lo primero que ve.
//
// El `?utm_source` sigue viajando en la query (antes iba después del `#`, donde
// no hay query que valga), y `ContactForm` lo lee al montar para que el lead
// llegue al CRM con su remite.

export const metadata: Metadata = {
  title: "Contacto — Kora",
  description:
    "Déjanos tus datos y te enseñamos Kora con tu hotel cargado: tus cuartos, tus tarifas y Camila contestando. Sin compromiso.",
  alternates: { canonical: "/contacto" },
};

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20de%20Kora`;

export default function ContactoPage() {
  return (
    <main className="pt-16">
      <section className="bg-kora-primary pt-14 pb-2 sm:pt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest">
              Hablemos
            </p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight leading-tight text-white">
              Te enseñamos Kora con tu hotel dentro
            </h1>
            <p className="mt-5 max-w-2xl text-white/80 text-base leading-relaxed">
              No es un demo genérico: cargamos tus cuartos y tus tarifas, y ves
              tu propio motor de reservas funcionando y a Camila contestando
              como lo haría con tus huéspedes. Si te convence, lo dejamos
              operando en {IMPLEMENTACION_HORAS} horas.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/70">
              <span className="inline-flex items-center gap-2">
                <MessageCircle size={15} className="text-kora-accent" aria-hidden="true" />
                Te contestamos por WhatsApp en menos de 24 horas
              </span>
              <a
                href={WA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-semibold text-kora-accent hover:text-white transition-colors"
              >
                <Phone size={15} aria-hidden="true" />
                O escríbenos ahora por WhatsApp
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* `ContactForm` trae su propio <section id="contacto"> con el mismo fondo,
          así que empalma con el encabezado de arriba sin costura. */}
      <ContactForm />
    </main>
  );
}
