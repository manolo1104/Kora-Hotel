import type { Metadata } from "next";
import { ArrowRight, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/landing/ContactForm";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";
import { GARANTIA, RUTA_REGISTRO } from "@/lib/oferta";
import { waLink } from "@/lib/contacto";

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
// vista y sin saber por qué. Aquí el formulario va justo después del encabezado
// (y, desde el 15 sep 2026, del aviso de que puede crear su cuenta y probarlo).
//
// El `?utm_source` sigue viajando en la query (antes iba después del `#`, donde
// no hay query que valga), y `ContactForm` lo lee al montar para que el lead
// llegue al CRM con su remite.
//
// 🔴 QUÉ CAMBIÓ EL 15 SEP 2026. Esta página prometía «cargamos tus cuartos y tus
// tarifas… si te convence, lo dejamos operando en 24 horas». Manolo decidió
// pasar a autoservicio: el hotelero crea su cuenta y lo prueba con su hotel, y
// nosotros ayudamos si quiere. Las herramientas, el blog y /para ya no traen
// aquí (van al registro). /contacto sigue siendo la vía de ayuda para quien
// prefiere hablar con alguien, pero lo PRIMERO que ve es el aviso de que puede
// probarlo solo, ahora mismo.

export const metadata: Metadata = {
  title: "Contacto — Kora",
  description:
    "¿Tienes dudas o prefieres que te acompañemos? Déjanos tus datos y te ayudamos a dejar Kora listo con tu hotel. O crea tu cuenta gratis y pruébalo tú mismo.",
  alternates: { canonical: "/contacto" },
};

const WA_URL = waLink("Hola, quiero más información de Kora");

export default function ContactoPage() {
  return (
    <main className="pt-16">
      <section className="bg-kora-primary pt-14 pb-2 sm:pt-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Primero, el camino principal: probarlo sin esperar a nadie. */}
          <Reveal>
            <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-white/15 bg-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="min-w-0">
                <p className="text-base font-bold text-white">
                  ¿Quieres probarlo? Crea tu cuenta gratis
                </p>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  Carga tu hotel y pruébalo por dentro: {GARANTIA.diasPrueba} días
                  gratis, sin tarjeta y sin esperar a que te contestemos.
                </p>
              </div>
              <CtaLink
                href={RUTA_REGISTRO}
                ctaName="contacto_registro"
                className="btn-press btn-arrow btn-fill inline-flex flex-shrink-0 items-center justify-center gap-2 self-start rounded-full bg-kora-accent px-6 py-3.5 text-sm font-bold text-kora-primary transition-colors hover:bg-kora-accent-dark sm:self-auto"
              >
                Crear mi cuenta gratis
                <ArrowRight size={16} aria-hidden="true" />
              </CtaLink>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest">
              Hablemos
            </p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight leading-tight text-white">
              ¿Prefieres que te acompañemos?
            </h1>
            <p className="mt-5 max-w-2xl text-white/80 text-base leading-relaxed">
              Kora lo configuras tú desde tu panel, y si tienes dudas o quieres
              ayuda para dejarlo listo, déjanos tus datos y te escribimos.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/70">
              <span className="inline-flex items-center gap-2">
                <MessageCircle size={15} className="text-kora-accent" aria-hidden="true" />
                {/* Decía «en menos de 24 horas»: nadie lo mide, así que no se
                    promete (mismo criterio que ContactForm). */}
                Te contestamos por WhatsApp
              </span>
              {WA_URL && (
                <a
                  href={WA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-kora-accent hover:text-white transition-colors"
                >
                  <Phone size={15} aria-hidden="true" />
                  O escríbenos ahora por WhatsApp
                </a>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* `ContactForm` trae su propio <section id="contacto"> con el mismo fondo,
          así que empalma con el encabezado de arriba sin costura.
          `registroArriba`: esta página ya abre con el botón de crear cuenta y
          con el título «¿Prefieres que te acompañemos?». Sin esta prop salían
          los dos repetidos a media pantalla de distancia. En la portada, donde
          no hay nada de eso arriba, el formulario sigue trayendo los suyos. */}
      <ContactForm registroArriba />
    </main>
  );
}
