import Link from "next/link";
import { Reveal } from "@/components/shared/Reveal";
import { ArrowRight } from "lucide-react";
import { SuscripcionForm } from "@/components/shared/SuscripcionForm";
import { CtaLink } from "@/components/shared/CtaLink";
import { OTA_ANTES, OTA_DESPUES } from "@/lib/caso-paraiso";
import { EMAIL_CONTACTO, WHATSAPP, waLink } from "@/lib/contacto";
import { GARANTIA, RUTA_REGISTRO } from "@/lib/oferta";

// El número se muestra como se dice en voz alta («+52 489 125 1458») pero sale
// de `WHATSAPP`: estaba escrito a mano aquí, y el día que Manolo cambie de número
// el enlace se habría actualizado solo y el texto visible no.
function numeroVisible(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("52")) {
    return `+52 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  return `+${d}`;
}

// Actualiza estas URLs cuando crees las cuentas sociales
const LINKEDIN_URL = ""; // e.g. "https://linkedin.com/company/kora-hotel"
const INSTAGRAM_URL = ""; // e.g. "https://instagram.com/korahotel"

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Agente de WhatsApp con IA", href: "/whatsapp" },
  { label: "Características", href: "/caracteristicas" },
  { label: "Cómo empezar", href: "/como-funciona" },
  { label: "Precios", href: "/precios" },
  // Un enlace al ÍNDICE, no dos sueltos: el pie enlazaba a mano sólo
  // `hoteles-boutique` y `hoteles-pequenos`, y las otras 7 páginas de la sección
  // se quedaban sin un solo enlace entrante en todo el sitio. Desde /para se
  // llega a las 9 con un clic, y las dos de antes no pierden nada.
  { label: "Para tu tipo de hotel", href: "/para" },
  { label: "Reservas directas por ciudad", href: "/hoteles-en" },
  { label: "Comparativas", href: "/comparativas" },
  { label: "Glosario hotelero", href: "/glosario" },
  { label: "Blog", href: "/blog" },
  { label: "Guía: plan de 90 días", href: "/guia" },
  { label: "Demo", href: "/casos/paraiso-encantado" },
];

const toolLinks = [
  { label: "Todas las herramientas", href: "/herramientas" },
  { label: "Calculadora de comisiones", href: "/herramientas/calculadora-comisiones" },
  { label: "Calculadora de tarifa", href: "/herramientas/calculadora-tarifa" },
  { label: "Diagnóstico de tu hotel", href: "/herramientas/diagnostico" },
  { label: "Crea tu página gratis", href: "/herramientas/mini-pagina" },
];

const legalLinks = [
  { label: "Política de privacidad", href: "/privacidad" },
  { label: "Términos de servicio", href: "/terminos" },
];

export function Footer() {
  return (
    <footer className="bg-[#0F1F15] text-white pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Suscripción: la única puerta del pie que pide algo. Va arriba de los
            enlaces porque el pie se lee de arriba a abajo y quien llegó hasta
            aquí ya recorrió la página entera. */}
        <Reveal>
          <div className="mb-12 rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-2 lg:items-center lg:gap-12">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-kora-accent">
                  Guía gratis
                </p>
                <p className="mt-2 text-lg font-bold leading-snug tracking-tight text-white sm:text-xl">
                  Del {OTA_ANTES}% al {OTA_DESPUES}% de dependencia de Booking
                  en 90 días
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  El plan que seguí en mi hotel de Xilitla, semana por semana.
                  Te lo mando por correo junto con las plantillas de WhatsApp
                  que usé.
                </p>
              </div>
              <SuscripcionForm origen="footer" piel="oscuro" />
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b border-white/10">
          {/* Brand */}
          <Reveal>
            <div>
              <p className="text-2xl font-bold text-white tracking-tight">Kora</p>
              <p className="text-sm text-white/50 mt-1 leading-relaxed">
                Sistema hotelero con IA para hoteles boutique en México.
              </p>
              <p className="text-sm text-white/40 mt-3">
                Hecho en la Huasteca Potosina, México
              </p>
              {/* El registro también en el pie (decisión de Manolo, 15 sep 2026):
                  quien llega hasta aquí ya leyó la página y no tenía por dónde
                  empezar, sólo WhatsApp y la guía. */}
              <CtaLink
                href={RUTA_REGISTRO}
                ctaName="footer_onboarding"
                className="btn-press btn-arrow mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-kora-accent text-kora-primary text-sm font-bold hover:bg-kora-accent-dark transition-colors"
              >
                Crear cuenta gratis
                <ArrowRight size={15} aria-hidden="true" />
              </CtaLink>
              <p className="mt-2 text-xs text-white/40">
                {GARANTIA.diasPrueba} días gratis, sin tarjeta
              </p>
            </div>
          </Reveal>

          {/* Nav */}
          <Reveal delay={0.1}>
            <nav aria-label="Navegación del pie de página">
              <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">
                Producto
              </p>
              <ul className="space-y-2.5">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="nav-link text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>

          {/* Herramientas gratis */}
          <Reveal delay={0.15}>
            <nav aria-label="Herramientas gratis">
              <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">
                Herramientas gratis
              </p>
              <ul className="space-y-2.5">
                {toolLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="nav-link text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>

          {/* Contact */}
          <Reveal delay={0.2}>
            <div>
              <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">
                Contacto
              </p>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href={`mailto:${EMAIL_CONTACTO}`}
                    className="nav-link text-sm text-white/60 hover:text-white transition-colors"
                  >
                    {EMAIL_CONTACTO}
                  </a>
                </li>
                <li>
                  <a
                    href={waLink("Hola, tengo una duda sobre Kora")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-link text-sm text-white/60 hover:text-white transition-colors"
                  >
                    WhatsApp {numeroVisible(WHATSAPP)}
                  </a>
                </li>
              </ul>

              {(LINKEDIN_URL || INSTAGRAM_URL) && (
                <div className="mt-5 flex gap-3">
                  {LINKEDIN_URL && (
                    <a
                      href={LINKEDIN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn de Kora"
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/60 hover:text-white text-xs font-bold"
                    >
                      in
                    </a>
                  )}
                  {INSTAGRAM_URL && (
                    <a
                      href={INSTAGRAM_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram de Kora"
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white/60 hover:text-white text-xs font-bold"
                    >
                      ig
                    </a>
                  )}
                </div>
              )}
            </div>
          </Reveal>
        </div>

        {/* Micro-sellos de confianza */}
        <Reveal delay={0.22}>
          <div className="mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-2">
              Pagos seguros con
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/integraciones/stripe.svg"
                alt="Stripe"
                className="h-4 w-auto opacity-60 brightness-0 invert"
              />
            </span>
            <span>Tus datos son tuyos, exportables cuando quieras</span>
          </div>
        </Reveal>

        {/* Bottom */}
        <Reveal delay={0.25}>
          <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <p className="text-xs text-white/30">
              © 2026 Kora. Todos los derechos reservados.
            </p>
            <nav
              className="flex items-center gap-5 text-xs text-white/40"
              aria-label="Links legales"
            >
              {legalLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-white/70 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
