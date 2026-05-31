"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { HerramientaIcono } from "@/components/herramientas/HerramientaIcono";
import { herramientas } from "@/lib/herramientas";

// Recorrido curado entre estacas: cada herramienta sugiere 3 relacionadas que
// continúan la conversación y exponen más de Kora.
const RELACIONADAS: Record<string, string[]> = {
  "calculadora-comisiones": ["tarifa-neta", "descuento-maximo", "diagnostico"],
  "calculadora-tarifa": ["calendario-puentes", "tarifa-neta", "descuento-maximo"],
  "punto-de-equilibrio": ["descuento-maximo", "calculadora-comisiones", "calculadora-impuestos"],
  "calculadora-impuestos": ["cotizacion", "anticipo", "documentos"],
  diagnostico: ["calculadora-comisiones", "calculadora-tarifa", "mini-pagina"],
  "tarifa-neta": ["calculadora-comisiones", "calculadora-tarifa", "calendario-puentes"],
  "descuento-maximo": ["punto-de-equilibrio", "calculadora-tarifa", "calendario-puentes"],
  "auditoria-ficha": ["descripcion-hotel", "respuestas-resenas", "mini-pagina"],
  "calendario-puentes": ["calculadora-tarifa", "tarifa-neta", "descuento-maximo"],
  cotizacion: ["anticipo", "calculadora-impuestos", "qr-reservas"],
  documentos: ["cotizacion", "calculadora-impuestos", "mini-pagina"],
  "qr-reservas": ["mini-pagina", "calculadora-comisiones", "cotizacion"],
  anticipo: ["cotizacion", "mensajes-whatsapp", "calculadora-impuestos"],
  "respuestas-resenas": ["mensajes-whatsapp", "mensajes-huesped", "auditoria-ficha"],
  "mensajes-whatsapp": ["respuestas-resenas", "mensajes-huesped", "anticipo"],
  "descripcion-hotel": ["auditoria-ficha", "mini-pagina", "respuestas-resenas"],
  "mensajes-huesped": ["respuestas-resenas", "mensajes-whatsapp", "descripcion-hotel"],
};

export function HerramientasRelacionadas() {
  const path = usePathname() ?? "";
  const slug = path.split("/").filter(Boolean)[1]; // /herramientas/<slug>

  const relacionadas = slug ? RELACIONADAS[slug] : undefined;
  if (!relacionadas) return null; // índice, mini-página o ruta desconocida

  const items = relacionadas
    .map((s) => herramientas.find((h) => h.slug === s && h.disponible))
    .filter((h): h is NonNullable<typeof h> => Boolean(h));
  if (items.length === 0) return null;

  return (
    <section className="py-14 sm:py-16 bg-white border-t border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-xl sm:text-2xl font-bold text-kora-text tracking-tight text-center">
            Sigue mejorando tu hotel
          </h2>
          <p className="mt-2 text-sm text-kora-muted text-center">
            Otras herramientas gratis que te pueden servir.
          </p>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {items.map((h, i) => (
            <Reveal key={h.slug} delay={0.05 + i * 0.06}>
              <Link
                href={`/herramientas/${h.slug}`}
                className="card-hover group flex flex-col h-full bg-kora-bg rounded-2xl p-5 border border-gray-100 hover:border-kora-accent transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-kora-primary/5 flex items-center justify-center text-kora-primary shrink-0">
                    <HerramientaIcono slug={h.slug} size={18} />
                  </span>
                  <span className="text-[10px] font-bold text-kora-accent bg-kora-accent/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                    {h.etiqueta}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-kora-text leading-snug">
                  {h.titulo}
                </h3>
                <p className="mt-1 text-xs text-kora-muted leading-relaxed flex-1">
                  {h.resumen}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary">
                  Usar gratis
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
