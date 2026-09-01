import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Image as ImageIcon } from "lucide-react";
import { CasoTabs } from "@/components/cases/CasoTabs";
import { BarraCTA } from "@/components/shared/BarraCTA";
import { Reveal } from "@/components/shared/Reveal";
import { CountUp } from "@/components/shared/CountUp";
import {
  CASO,
  OTA_ANTES,
  OTA_DESPUES,
  MESES,
  AHORRO_MENSUAL,
  AHORRO_ANUAL,
  IMPLEMENTACION_HORAS,
  mxn,
} from "@/lib/caso-paraiso";
import { WHATSAPP } from "@/lib/contacto";

export const metadata: Metadata = {
  title: "Caso de estudio: Hotel Paraíso Encantado — Kora",
  description: `Hotel Paraíso Encantado, en Xilitla SLP, bajó su dependencia de las OTAs del ${OTA_ANTES}% al ${OTA_DESPUES}% en ${MESES} meses y dejó de pagar ${mxn(AHORRO_MENSUAL)} MXN al mes en comisiones. Es el hotel del fundador de Kora.`,
  alternates: {
    canonical: "/casos/paraiso-encantado",
  },
};

const WA_URL = `https://wa.me/${WHATSAPP.replace(/\D/g, "")}?text=Hola%2C%20vi%20el%20caso%20de%20Par%C3%A1iso%20Encantado%20y%20quiero%20saber%20m%C3%A1s`;

// ─── Fotos del hotel ──────────────────────────────────────────────────────────
// Cuando tengas fotos, pega aquí las URLs.
// Puedes subir las imágenes a /public/hotel/ y referenciarlas como "/hotel/foto1.jpg"
// O usar URLs externas (Cloudinary, tu CDN, etc.)
const FOTOS_HOTEL: { src: string; alt: string }[] = [
  // { src: "/hotel/fachada.jpg", alt: "Fachada del Hotel Paraíso Encantado" },
  // { src: "/hotel/habitacion-suite.jpg", alt: "Suite Jardín" },
  // { src: "/hotel/alberca.jpg", alt: "Área de alberca y jardín" },
  // { src: "/hotel/entorno.jpg", alt: "Entorno natural en Xilitla" },
];

export default function CasoParaisoEncantadoPage() {
  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="py-20 sm:py-28 bg-kora-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center text-sm text-kora-accent/80 hover:text-kora-accent transition-colors mb-6"
          >
            ← Casos de estudio
          </Link>
          <Reveal>
            <p className="text-kora-accent text-sm font-semibold uppercase tracking-widest mb-4">
              Caso de estudio
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
              Hotel Paraíso Encantado
            </h1>
            <p className="mt-3 text-white/70 text-lg">
              Xilitla, San Luis Potosí · Hotel boutique de naturaleza
            </p>
            <p className="mt-6 text-white/80 text-base leading-relaxed max-w-2xl">
              Kora no se construyó para vendérselo a alguien: se construyó para
              este hotel, porque es el mío. En {MESES} meses la parte de mis
              reservas que llegaba por Booking pasó del {OTA_ANTES}% al{" "}
              {OTA_DESPUES}%. Esto es lo que pasó, con los números a la vista.
            </p>
          </Reveal>

          {/* Summary metrics */}
          <Reveal delay={0.15}>
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
              {[
                {
                  from: OTA_ANTES,
                  to: OTA_DESPUES,
                  prefix: `${OTA_ANTES}% → `,
                  suffix: "%",
                  label: `Dependencia de OTAs en ${MESES} meses`,
                },
                {
                  to: AHORRO_MENSUAL,
                  prefix: "$",
                  suffix: "",
                  label: "MXN/mes que dejé de pagar en comisiones",
                },
                {
                  to: IMPLEMENTACION_HORAS,
                  prefix: "",
                  suffix: " hrs",
                  label: "Para dejarlo operando",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="bg-white/10 rounded-2xl px-5 py-4 border border-white/10"
                >
                  <CountUp
                    to={m.to}
                    from={m.from}
                    prefix={m.prefix}
                    suffix={m.suffix}
                    className="block text-2xl font-bold text-kora-accent tabular-nums"
                  />
                  <p className="text-sm text-white/70 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Hotel info strip */}
      <section className="py-6 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-6 text-sm text-kora-muted">
            {[
              { label: "Hotel", value: "Paraíso Encantado" },
              { label: "Ubicación", value: CASO.ciudad },
              { label: "Tipo", value: "Boutique de naturaleza" },
              { label: "Habitaciones", value: String(CASO.habitaciones) },
              {
                label: "Tiempo de implementación",
                value: `${IMPLEMENTACION_HORAS} horas`,
              },
            ].map((item) => (
              <div key={item.label}>
                <span className="font-semibold text-kora-text">
                  {item.label}:
                </span>{" "}
                {item.value}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Galería del hotel — aparece cuando FOTOS_HOTEL tiene imágenes */}
      {FOTOS_HOTEL.length > 0 && (
        <section className="py-10 bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FOTOS_HOTEL.map((foto, i) => (
                <div
                  key={i}
                  className={`overflow-hidden rounded-xl ${i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square"}`}
                >
                  <img
                    src={foto.src}
                    alt={foto.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Placeholder visible hasta que lleguen las fotos */}
      {FOTOS_HOTEL.length === 0 && (
        <section className="py-8 bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { span: "col-span-2 row-span-2 aspect-square", label: "Fachada" },
                { span: "aspect-square", label: "Habitación" },
                { span: "aspect-square", label: "Jardín" },
              ].map((slot, i) => (
                <div
                  key={i}
                  className={`${slot.span} rounded-xl bg-kora-primary/8 border-2 border-dashed border-kora-primary/20 flex flex-col items-center justify-center gap-2`}
                >
                  <ImageIcon size={22} className="text-kora-primary/40" aria-hidden="true" />
                  <span className="text-xs font-medium text-kora-muted">
                    {slot.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Tabs section */}
      <section className="py-14 sm:py-20 bg-kora-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CasoTabs />
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 bg-white border-t border-gray-100">
        <Reveal className="max-w-xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-kora-text mb-3">
            ¿Cuánto le vas a dar a Booking este año?
          </h2>
          <p className="text-kora-muted text-sm mb-7">
            Es una cuenta de diez segundos: lo que pagaste de comisión el mes
            pasado, por doce. En mi hotel eran{" "}
            <span className="font-semibold text-kora-text">
              {mxn(AHORRO_ANUAL)} MXN al año
            </span>
            . Escríbeme y en 20 minutos te enseño cómo se vería Kora con tus
            cuartos y tus tarifas cargados.
          </p>
          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press btn-arrow btn-fill inline-flex items-center gap-2 px-8 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Quiero ver el demo
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </Reveal>
      </section>

      <BarraCTA />
    </main>
  );
}
