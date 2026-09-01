"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageSquareText,
  MessageCircle,
  FileText,
  UserRound,
  Calculator,
  ExternalLink,
} from "lucide-react";
import { GeneradorIA, type CampoDef } from "@/components/herramientas/GeneradorIA";

interface Herramienta {
  id: string;
  tipo: string;
  label: string;
  Icon: typeof MessageSquareText;
  tituloCard: string;
  subtituloCard: string;
  botonLabel: string;
  resultadoLabel: string;
  campos: CampoDef[];
}

// Enlaces a las calculadoras públicas (no-IA) que ya viven en /herramientas.
const CALCULADORAS = [
  { slug: "calculadora-comisiones", label: "Cuánto pierdes en comisiones" },
  { slug: "tarifa-neta", label: "Tarifa neta por canal" },
  { slug: "punto-de-equilibrio", label: "Punto de equilibrio" },
  { slug: "descuento-maximo", label: "Descuento máximo seguro" },
  { slug: "calculadora-impuestos", label: "IVA e impuesto de hospedaje" },
  { slug: "calendario-puentes", label: "Calendario de puentes" },
];

export function HerramientasPanelClient({ hotelNombre }: { hotelNombre: string }) {
  const HERRAMIENTAS: Herramienta[] = [
    {
      id: "resena",
      tipo: "resena",
      label: "Responder reseñas",
      Icon: MessageSquareText,
      tituloCard: "Pega la reseña del huésped",
      subtituloCard: "La IA te devuelve una respuesta profesional lista para publicar en Google, Booking o Airbnb.",
      botonLabel: "Generar respuesta",
      resultadoLabel: "Tu respuesta sugerida",
      campos: [
        { name: "resena", label: "Reseña del huésped", type: "textarea", required: true, placeholder: "Pega aquí la reseña tal como la escribió el huésped…" },
        { name: "hotel", label: "Nombre de tu hotel", type: "text", placeholder: "Ej. Hotel Casa del Río", default: hotelNombre },
        { name: "calificacion", label: "Calificación que dejó", type: "select", options: ["Excelente (5/5)", "Buena (4/5)", "Regular (3/5)", "Mala (2/5)", "Muy mala (1/5)"] },
        { name: "tono", label: "Tono de la respuesta", type: "select", default: "Amable y cercano", options: ["Amable y cercano", "Profesional", "Cálido y agradecido"] },
      ],
    },
    {
      id: "whatsapp",
      tipo: "whatsapp",
      label: "Mensajes de WhatsApp",
      Icon: MessageCircle,
      tituloCard: "Escribe un mensaje de WhatsApp",
      subtituloCard: "Confirmaciones, cotizaciones, recordatorios de anticipo… en segundos.",
      botonLabel: "Generar mensaje",
      resultadoLabel: "Tu mensaje sugerido",
      campos: [
        { name: "hotel", label: "Nombre de tu hotel", type: "text", placeholder: "Ej. Hotel Casa del Río", default: hotelNombre },
        { name: "situacion", label: "¿Qué quieres decir?", type: "text", required: true, placeholder: "Ej. confirmar una reserva / pedir anticipo / responder una duda" },
        { name: "detalle", label: "Detalles", type: "textarea", placeholder: "Fechas, habitación, precio, lo que ya sabes…" },
      ],
    },
    {
      id: "descripcion",
      tipo: "descripcion",
      label: "Descripción del hotel",
      Icon: FileText,
      tituloCard: "Describe tu hotel para Booking o tu web",
      subtituloCard: "Una descripción atractiva y honesta, lista para copiar.",
      botonLabel: "Generar descripción",
      resultadoLabel: "Tu descripción",
      campos: [
        { name: "hotel", label: "Nombre de tu hotel", type: "text", required: true, placeholder: "Ej. Hotel Casa del Río", default: hotelNombre },
        { name: "zona", label: "Zona y atractivos cercanos", type: "text", placeholder: "Tu pueblo, y qué hay cerca que valga el viaje" },
        { name: "amenidades", label: "Amenidades", type: "text", placeholder: "Alberca, desayuno, WiFi, estacionamiento…" },
        { name: "estilo", label: "Estilo del hotel", type: "text", placeholder: "Boutique, familiar, ecológico, romántico…" },
      ],
    },
    {
      id: "huesped",
      tipo: "huesped",
      label: "Mensajes al huésped",
      Icon: UserRound,
      tituloCard: "Mensaje para el huésped",
      subtituloCard: "Antes de llegar, bienvenida, check-out o pedir una reseña.",
      botonLabel: "Generar mensaje",
      resultadoLabel: "Tu mensaje sugerido",
      campos: [
        { name: "hotel", label: "Nombre de tu hotel", type: "text", placeholder: "Ej. Hotel Casa del Río", default: hotelNombre },
        { name: "etapa", label: "Etapa de la estancia", type: "select", required: true, options: ["Antes de llegar", "Bienvenida al llegar", "Durante la estancia", "Check-out", "Pedir una reseña"] },
        { name: "detalle", label: "Detalles (horarios, indicaciones…)", type: "textarea", placeholder: "Check-in 3pm, cómo llegar, contraseña del WiFi…" },
      ],
    },
  ];

  const [activa, setActiva] = useState(HERRAMIENTAS[0].id);
  const herr = HERRAMIENTAS.find((h) => h.id === activa) ?? HERRAMIENTAS[0];

  return (
    <div>
      {/* Selector de herramienta */}
      <div className="flex flex-wrap gap-2 mb-8">
        {HERRAMIENTAS.map((h) => {
          const on = h.id === activa;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => setActiva(h.id)}
              aria-pressed={on}
              className={`btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border transition-colors ${
                on
                  ? "bg-kora-primary text-white border-kora-primary"
                  : "bg-panel-surface text-kora-muted border-panel-border hover:border-kora-accent"
              }`}
            >
              <h.Icon size={16} aria-hidden="true" />
              {h.label}
            </button>
          );
        })}
      </div>

      {/* Herramienta activa (remontada por key para reiniciar el formulario) */}
      <GeneradorIA
        key={herr.id}
        tipo={herr.tipo}
        tituloCard={herr.tituloCard}
        subtituloCard={herr.subtituloCard}
        campos={herr.campos}
        botonLabel={herr.botonLabel}
        resultadoLabel={herr.resultadoLabel}
        ocultarLead
        ocultarCta
      />

      {/* Más herramientas (calculadoras) */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="bg-panel-surface rounded-2xl p-6 sm:p-7 border border-panel-border-soft shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calculator size={18} className="text-kora-primary" aria-hidden="true" />
            <h2 className="text-lg font-bold text-kora-text">Calculadoras para tu hotel</h2>
          </div>
          <p className="text-sm text-kora-muted mb-4">
            Herramientas rápidas para tomar mejores decisiones de precio e ingresos.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {CALCULADORAS.map((c) => (
              <Link
                key={c.slug}
                href={`/herramientas/${c.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press inline-flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-panel-border text-sm font-semibold text-kora-text hover:border-kora-accent transition-colors"
              >
                {c.label}
                <ExternalLink size={14} className="text-kora-muted" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
