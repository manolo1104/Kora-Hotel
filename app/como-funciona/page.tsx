import type { Metadata } from "next";
import Link from "next/link";
import {
  UserPlus,
  BedDouble,
  FlaskConical,
  PlugZap,
  BadgeCheck,
  MessageCircle,
  CalendarCheck,
  LayoutDashboard,
  ArrowRight,
  ShieldCheck,
  CalendarX,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { DrawLine } from "@/components/shared/DrawLine";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { CtaLink } from "@/components/shared/CtaLink";
import { JsonLd } from "@/components/shared/JsonLd";
import { waLink } from "@/lib/contacto";
import {
  AYUDA_ALTA,
  GARANTIA,
  PASOS_ALTA,
  PRECIO_DESDE,
  RUTA_REGISTRO,
} from "@/lib/oferta";

// ─── Por qué esta página se reescribió entera (15 sep 2026) ───────────────────
//
// Hasta ese día contaba un proceso que NO existía: «Solicitas acceso por
// WhatsApp» → «Nosotros configuramos todo, conectamos Booking y Expedia» →
// «Migración de reservas» → «Capacitación de 30 minutos», con la garantía
// «Setup en 24 horas o te devolvemos el primer mes». Tres de esos pasos eran
// falsos: la sincronía con OTAs está apagada (`CANALES_OTA_DISPONIBLES = false`),
// no hay importador de reservas y la garantía de 24 h no estaba en los Términos.
// Y el único botón de la página llevaba a WhatsApp, mientras el alta real es por
// cuenta propia desde el registro.
//
// Decisión de Manolo: aquí tiene que quedar claro que hay que REGISTRARSE y que
// Kora se prueba por dentro. Por eso los pasos salen de `PASOS_ALTA` (la misma
// fuente que usan la portada y el panel) y ningún número se escribe a mano: si
// cambian los días de prueba o el precio, esta página cambia sola.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const DIAS = GARANTIA.diasPrueba;
const PRECIO = PRECIO_DESDE.toLocaleString("es-MX");

// Sin `openGraph` propio a propósito: el del layout (siteName, locale, tipo) se
// hereda entero y Next copia este título y esta descripción a la tarjeta de
// WhatsApp/Facebook (`inheritFromMetadata`). Definirlo aquí lo REEMPLAZARÍA y
// habría que repetir siteName y locale a mano.
export const metadata: Metadata = {
  title: "Cómo funciona Kora — Regístrate y pruébalo gratis con tu hotel",
  description: `Crea tu cuenta, carga tu hotel y prueba Kora por dentro ${DIAS} días gratis, sin tarjeta: Camila con tus datos, una reserva de prueba y tu panel.`,
  alternates: {
    canonical: "/como-funciona",
  },
};

// Mensaje ya escrito para quien prefiere que lo acompañen. Es la vía secundaria:
// el botón grande de la página es siempre el registro.
const WA_AYUDA = waLink("Hola, quiero que me ayuden a dejar mi hotel listo en Kora");

// Un icono por paso, en el mismo orden que `PASOS_ALTA`. Si algún día hay más
// pasos que iconos, el sobrante usa el último en vez de romper la página.
const ICONOS_PASO: LucideIcon[] = [UserPlus, BedDouble, FlaskConical, PlugZap, BadgeCheck];
const iconoDelPaso = (i: number) => ICONOS_PASO[Math.min(i, ICONOS_PASO.length - 1)];

// Lo que se puede probar dentro de la cuenta SIN huéspedes reales. Cada frase
// describe algo que ya funciona hoy:
//  · el chat de prueba de Camila usa los datos y la disponibilidad reales del
//    hotel y tiene apagada la herramienta de reservar (`api/admin/bot-preview`);
//  · el motor simula el pago mientras el hotel está EN PRUEBA y sus cobros de
//    Stripe no están listos (`lib/motor/modo-prueba.ts`). La condición va entera
//    en el texto: la primera versión decía sólo «mientras no conectes tus
//    cobros», y un hotel que ACTIVA su plan sin conectar Stripe sale del modo
//    prueba y su motor cobra de verdad (a la cuenta de Kora). Tampoco se guarda
//    nada: «el hotel no la recibe» (`pruebaDatosSub` en lib/booking/i18n.ts), así
//    que no se promete que la reserva de prueba aparezca en el panel. Y se avisa
//    de que, mientras tanto, un huésped real tampoco puede pagar: el motor le
//    manda escribir al hotel (`pruebaConfWa` / `pruebaConfSinWa`);
//  · las reservas a mano salen en el calendario y arman la ficha del cliente
//    (`buildCRM` parte de las reservas).
const QUE_PROBAR: { Icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    Icon: MessageCircle,
    titulo: "Camila, con los datos de tu hotel",
    texto:
      "En el chat de prueba le escribes como si fueras un huésped. Te contesta con tus habitaciones, tus tarifas y tu disponibilidad. No aparta ni cobra nada: es para que veas cómo atendería tu WhatsApp antes de vincularlo.",
  },
  {
    Icon: CalendarCheck,
    titulo: "Una reserva de prueba en tu motor",
    texto:
      "Durante tu prueba, y mientras no conectes tus cobros con Stripe, el pago de tu motor se simula: recorres la reserva completa, como la haría un huésped, sin que se cobre ni se guarde nada. Mientras tanto, a un huésped real el motor le pide que te contacte directo. Cuando conectas tus cobros o activas tu plan, el motor cobra de verdad.",
  },
  {
    Icon: LayoutDashboard,
    titulo: "Tu panel: reservas, calendario y clientes",
    texto:
      "Registra una reserva a mano con los datos de un huésped y mira cómo aparece en tu calendario y en tus clientes. Así conoces el día a día antes de recibir reservas reales.",
  },
];

// Garantías que se pueden cumplir y que dicen lo mismo que los Términos. La de
// devolución sale de `GARANTIA`, igual que en /precios y en `app/terminos`.
const GARANTIAS: { Icon: LucideIcon; titulo: string; texto: string }[] = [
  {
    Icon: ShieldCheck,
    titulo: `${DIAS} días gratis, sin tarjeta`,
    texto:
      "Para crear tu cuenta no te pedimos ningún dato de pago. Activas tu plan sólo si te convence.",
  },
  {
    Icon: CalendarX,
    titulo: "Sin permanencia",
    texto: `$${PRECIO} MXN al mes con habitaciones ilimitadas. Cancelas tú mismo desde tu panel, cuando quieras.`,
  },
  {
    Icon: RotateCcw,
    titulo: `Devolución en ${GARANTIA.diasDevolucion} días`,
    texto: `Si activas tu plan y cancelas dentro de los ${GARANTIA.diasDevolucion} días siguientes a tu primer pago, te devolvemos esa mensualidad.`,
  },
];

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "@id": `${SITE_URL}/como-funciona#como-empezar`,
  name: "Cómo empezar con Kora en tu hotel",
  description: `Crea tu cuenta, carga tu hotel y prueba Kora por dentro ${DIAS} días gratis, sin tarjeta.`,
  inLanguage: "es-MX",
  // Lo que cuesta seguir los pasos durante la prueba: nada. El plan de pago es
  // el último paso y es opcional, así que no es un coste de «cómo empezar».
  estimatedCost: { "@type": "MonetaryAmount", currency: "MXN", value: "0" },
  step: PASOS_ALTA.map((p, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: p.titulo,
    text: p.texto,
    url: `${SITE_URL}/como-funciona#paso-${i + 1}`,
  })),
};

const BOTON_PRINCIPAL =
  "btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-base hover:bg-kora-accent-dark transition-colors";

export default function ComoFuncionaPage() {
  return (
    <main className="pt-16">
      <JsonLd data={howToJsonLd} />

      {/* Hero: la promesa nueva, con el registro como único botón grande */}
      <section className="py-20 sm:py-28 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Cómo empezar
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Regístrate, carga tu hotel y pruébalo por dentro
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-6 text-white/75 text-lg leading-relaxed max-w-xl mx-auto">
              {DIAS} días gratis, sin tarjeta. Lo configuras tú desde tu panel,
              sin instalar nada, y si prefieres que te acompañemos, te ayudamos.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-9 flex flex-col items-center gap-3">
              <CtaLink href={RUTA_REGISTRO} ctaName="como_funciona_hero_registro" className={BOTON_PRINCIPAL}>
                Crear mi cuenta gratis
                <ArrowRight size={18} aria-hidden="true" />
              </CtaLink>
              <p className="text-xs text-white/60">
                ¿Ya tienes cuenta?{" "}
                <Link href="/entrar" className="font-semibold text-white underline underline-offset-4 hover:text-kora-accent">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Los pasos del alta, desde la fuente única */}
      <section className="py-16 sm:py-24 bg-kora-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <Breadcrumbs
              items={[
                { name: "Inicio", href: "/" },
                { name: "Cómo funciona", href: "/como-funciona" },
              ]}
            />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kora-text mb-10">
            {PASOS_ALTA.length} pasos, a tu ritmo
          </h2>
          <div className="relative">
            {/* Línea vertical — se dibuja al hacer scroll */}
            <DrawLine className="absolute left-[22px] top-10 bottom-10 w-px bg-kora-primary/15 hidden sm:block" />

            <ol className="space-y-10">
              {PASOS_ALTA.map((paso, i) => {
                const Icono = iconoDelPaso(i);
                return (
                  <li key={paso.titulo} id={`paso-${i + 1}`} className="scroll-mt-24">
                    <Reveal delay={0.06 + i * 0.07}>
                      <div className="relative flex gap-6 sm:gap-8">
                        <div className="flex-shrink-0 relative z-10">
                          <div className="w-11 h-11 rounded-full bg-kora-primary flex items-center justify-center text-white shadow-md">
                            <Icono size={22} aria-hidden="true" />
                          </div>
                        </div>
                        <div className="pb-2 flex-1">
                          <span className="block text-xs font-bold text-kora-muted uppercase tracking-widest mb-1.5">
                            Paso {i + 1}
                          </span>
                          <h3 className="text-lg sm:text-xl font-bold text-kora-text mb-2">
                            {paso.titulo}
                          </h3>
                          <p className="text-sm sm:text-base text-kora-muted leading-relaxed">
                            {paso.texto}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>

          <Reveal delay={0.1}>
            <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4">
              <CtaLink
                href={RUTA_REGISTRO}
                ctaName="como_funciona_pasos_registro"
                className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-primary text-white font-bold text-sm hover:bg-kora-primary-dark transition-colors"
              >
                Empezar por el paso 1
                <ArrowRight size={16} aria-hidden="true" />
              </CtaLink>
              <p className="text-sm text-kora-muted">
                {DIAS} días gratis · sin tarjeta
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Qué se prueba por dentro */}
      <section className="py-16 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-10">
              <p className="text-xs font-bold uppercase tracking-widest text-kora-primary/70 mb-3">
                Dentro de tu cuenta
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-kora-text">
                Qué puedes probar sin tener huéspedes todavía
              </h2>
              <p className="mt-3 text-kora-muted text-sm sm:text-base leading-relaxed">
                Nada de demos genéricas: lo pruebas con tu propio hotel, con tus
                habitaciones y tus tarifas.
              </p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {QUE_PROBAR.map(({ Icon, titulo, texto }, i) => (
              <Reveal key={titulo} delay={0.06 + i * 0.08}>
                <div className="h-full rounded-2xl border border-gray-100 bg-kora-bg p-6">
                  <div className="w-10 h-10 rounded-xl bg-kora-accent/20 flex items-center justify-center mb-4">
                    <Icon size={20} className="text-kora-primary" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-kora-text text-base mb-2">{titulo}</h3>
                  <p className="text-sm text-kora-muted leading-relaxed">{texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Garantías verdaderas */}
      <section className="py-14 sm:py-16 bg-kora-bg border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-kora-text text-center mb-2">
            {GARANTIA.titulo}
          </h2>
          <p className="text-center text-sm text-kora-muted mb-10">
            Está por escrito en los{" "}
            <Link href="/terminos" className="underline underline-offset-2 hover:text-kora-primary">
              Términos
            </Link>
            , no sólo aquí.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {GARANTIAS.map(({ Icon, titulo, texto }, i) => (
              <Reveal key={titulo} delay={0.06 + i * 0.08}>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 h-full">
                  <Icon size={20} className="text-kora-primary mb-3" aria-hidden="true" />
                  <p className="font-bold text-kora-primary text-base mb-2">{titulo}</p>
                  <p className="text-sm text-kora-muted leading-relaxed">{texto}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Lo que conviene saber antes de empezar. Se dice aquí porque la versión
          anterior de esta página prometía justo esto, y quien la leyó puede
          venir esperándolo. */}
      <section className="py-12 bg-white border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-kora-primary/15 bg-kora-bg/60 p-6">
            <h2 className="text-base font-bold text-kora-text mb-2">
              Lo que conviene saber
            </h2>
            <p className="text-sm text-kora-muted leading-relaxed">
              Hoy Kora no importa reservas de otro sistema ni se conecta con
              Booking o Expedia. Las reservas que ya tienes las registras a mano
              en tu calendario, y las nuevas te llegan por tu motor de reservas.
            </p>
          </div>
        </div>
      </section>

      {/* Cierre: registro grande, WhatsApp pequeño */}
      <section className="py-16 sm:py-20 bg-kora-primary text-white">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
            Crea tu cuenta y prueba Kora con tu hotel
          </h2>
          <p className="text-white/75 mb-8">
            {DIAS} días gratis, sin tarjeta. Si te convence, activas tu plan de
            ${PRECIO} MXN al mes desde tu panel.
          </p>
          <CtaLink href={RUTA_REGISTRO} ctaName="como_funciona_cierre_registro" className={BOTON_PRINCIPAL}>
            Crear mi cuenta gratis
            <ArrowRight size={18} aria-hidden="true" />
          </CtaLink>
          {WA_AYUDA && (
            <p className="mt-6 text-sm text-white/70">
              <CtaLink
                href={WA_AYUDA}
                ctaName="como_funciona_ayuda_whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-white transition-colors"
              >
                {AYUDA_ALTA}
              </CtaLink>
            </p>
          )}
          <p className="mt-3 text-xs text-white/50">
            <Link href="/precios" className="underline underline-offset-4 hover:text-white">
              Ver precios
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
