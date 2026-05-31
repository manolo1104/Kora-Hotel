import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe, MessageCircle, BookOpen, QrCode } from "lucide-react";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app";

export const metadata: Metadata = {
  title: "Crea la página de reservas de tu hotel gratis | Kora",
  description:
    "Crea gratis una página de reservas directas por WhatsApp y una guía digital del huésped con QR para tu hotel. Sin comisiones, sin saber de tecnología. Para México.",
  alternates: { canonical: "/herramientas/mini-pagina" },
  openGraph: {
    title: "Crea la página de reservas de tu hotel gratis",
    description:
      "Una página de reservas directas por WhatsApp + guía del huésped con QR, gratis.",
    type: "website",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/herramientas/mini-pagina`,
  },
};

const pasos = [
  { icon: <Globe size={20} />, t: "Crea tu cuenta gratis", d: "Con tu correo, en un minuto. Sin tarjeta." },
  { icon: <MessageCircle size={20} />, t: "Llena los datos de tu hotel", d: "Nombre, fotos, habitaciones y tu WhatsApp." },
  { icon: <QrCode size={20} />, t: "Comparte tu enlace y tu QR", d: "En recepción, redes y habitaciones. Listo para recibir reservas directas." },
];

const faqs = [
  {
    q: "¿De verdad es gratis?",
    a: "Sí. Crear tu página de reservas y tu guía del huésped es gratis. La idea es que captures reservas directas (sin comisión) y veas lo fácil que es operar con Kora.",
  },
  {
    q: "¿Necesito saber de tecnología?",
    a: "No. Si sabes usar tu celular, puedes hacerlo: llenas un formulario, subes tus fotos y listo. Tu página y tu QR se generan solos.",
  },
  {
    q: "¿En qué se diferencia de Kora completo?",
    a: "Esta página gratis capta reservas por WhatsApp. Kora completo va más allá: un agente de IA que contesta, cotiza, cobra el anticipo y confirma la reserva solo, además de PMS, precio dinámico y facturación.",
  },
];

export default function MiniPaginaLanding() {
  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="py-16 sm:py-24 bg-kora-primary text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Gratis para hoteleros
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Tu página de reservas directas, gratis
            </h1>
          </Reveal>
          <Reveal delay={0.22}>
            <p className="mt-5 text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              Crea una página con tus fotos, habitaciones y botón “Reservar por
              WhatsApp”, más una guía digital del huésped con su QR. Sin comisiones
              y sin saber de tecnología.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <Link
              href="/entrar"
              className="btn-press btn-arrow btn-fill mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              Crear mi página gratis
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Qué incluye */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Reveal>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full">
                <MessageCircle size={24} className="text-kora-primary" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-bold text-kora-text">
                  Página de reservas por WhatsApp
                </h2>
                <p className="mt-1.5 text-sm text-kora-muted leading-relaxed">
                  Tus fotos, tus habitaciones con precio y un botón para que el
                  huésped te escriba y reserve directo. Cada reserva es 100% tuya.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm h-full">
                <BookOpen size={24} className="text-kora-primary" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-bold text-kora-text">
                  Guía digital del huésped
                </h2>
                <p className="mt-1.5 text-sm text-kora-muted leading-relaxed">
                  WiFi, horarios, reglas y recomendaciones en una página con QR para
                  la habitación. Menos preguntas repetidas, mejores reseñas.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-14 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight text-center mb-10">
            En 3 pasos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {pasos.map((p, i) => (
              <Reveal key={p.t} delay={0.06 + i * 0.08}>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-kora-primary text-white flex items-center justify-center mx-auto mb-3">
                    {p.icon}
                  </div>
                  <p className="font-bold text-kora-text">{p.t}</p>
                  <p className="mt-1 text-sm text-kora-muted leading-relaxed">{p.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/entrar"
              className="btn-press btn-arrow btn-fill inline-flex items-center gap-2 px-8 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              Crear mi página gratis
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight mb-6">
            Preguntas frecuentes
          </h2>
          <div className="space-y-4">
            {faqs.map((f, i) => (
              <Reveal key={f.q} delay={0.05 + i * 0.06}>
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100">
                  <h3 className="font-bold text-kora-text text-base mb-2">{f.q}</h3>
                  <p className="text-sm text-kora-muted leading-relaxed">{f.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-kora-muted">
            Ver todas las{" "}
            <Link
              href="/herramientas"
              className="font-semibold text-kora-primary underline hover:text-kora-primary-dark"
            >
              herramientas gratis para hoteles
            </Link>
            .
          </p>
        </div>
      </section>

      <BarraCTA />
    </main>
  );
}
