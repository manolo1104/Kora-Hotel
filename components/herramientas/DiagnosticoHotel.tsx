"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, RotateCcw, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

interface Opcion {
  label: string;
  valor: number; // 0 (peor) … 100 (mejor / más independiente)
}

interface Recomendacion {
  titulo: string;
  texto: string;
  ctaLabel: string;
  href: string;
}

interface Pregunta {
  area: string;
  pregunta: string;
  opciones: Opcion[];
  recomendacion: Recomendacion;
}

// Si la respuesta elegida tiene un valor menor o igual a este umbral,
// el punto se considera "débil" y aparece en el reporte personalizado.
const UMBRAL_DEBIL = 50;

const PREGUNTAS: Pregunta[] = [
  {
    area: "Dependencia de OTAs",
    pregunta:
      "De cada 10 reservas que recibes, ¿cuántas llegan por Booking, Airbnb o Expedia?",
    opciones: [
      { label: "8 o más", valor: 0 },
      { label: "Entre 5 y 7", valor: 40 },
      { label: "Entre 2 y 4", valor: 75 },
      { label: "1 o ninguna", valor: 100 },
    ],
    recomendacion: {
      titulo: "Dependes demasiado de las OTAs",
      texto:
        "Cada reserva por Booking o Airbnb te cuesta una comisión del 15% al 20%. Calcula cuánto se va al año — el número suele sorprender.",
      ctaLabel: "Calcular mis comisiones",
      href: "/herramientas/calculadora-comisiones",
    },
  },
  {
    area: "Reservas directas",
    pregunta:
      "¿Tienes una página propia donde un huésped pueda ver disponibilidad y reservar directo, sin pasar por Booking?",
    opciones: [
      { label: "No tengo página", valor: 0 },
      { label: "Tengo página, pero no se puede reservar ahí", valor: 40 },
      { label: "Sí, pero casi nadie la usa", valor: 75 },
      { label: "Sí, y recibo reservas directas seguido", valor: 100 },
    ],
    recomendacion: {
      titulo: "Te falta un canal de reservas propio",
      texto:
        "Sin una página donde reservar directo, dependes de que las OTAs te manden huéspedes — y les pagas comisión por cada uno. Una reserva directa es 100% tuya.",
      ctaLabel: "Ver cómo tener reservas directas",
      href: "/#contacto?utm_source=diagnostico",
    },
  },
  {
    area: "Respuesta 24/7",
    pregunta:
      "Cuando alguien te escribe a las 11 PM o un domingo, ¿qué pasa normalmente?",
    opciones: [
      { label: "Contesto cuando puedo, a veces hasta el día siguiente", valor: 0 },
      { label: "Trato de contestar, pero se me escapan varios", valor: 40 },
      { label: "Casi siempre contesto rápido yo mismo", valor: 70 },
      { label: "Algo o alguien contesta al instante, 24/7", valor: 100 },
    ],
    recomendacion: {
      titulo: "Se te escapan reservas fuera de horario",
      texto:
        "El huésped que no recibe respuesta rápido reserva en otro lado. Un agente de IA que conteste tu WhatsApp 24/7 captura justo esas reservas que hoy pierdes.",
      ctaLabel: "Ver el agente de IA de Kora",
      href: "/#contacto?utm_source=diagnostico",
    },
  },
  {
    area: "Precio dinámico",
    pregunta: "¿Cómo decides el precio de tus habitaciones?",
    opciones: [
      { label: "Es prácticamente el mismo todo el año", valor: 0 },
      { label: "Lo subo a ojo en temporada alta", valor: 50 },
      { label: "Lo ajusto según fechas y demanda, a mano", valor: 75 },
      { label: "Tengo precios que se ajustan solos según la demanda", valor: 100 },
    ],
    recomendacion: {
      titulo: "Estás dejando dinero en la mesa con tu precio",
      texto:
        "Cobrar lo mismo todo el año significa perder en los puentes y quedarte vacío en temporada baja. Calcula tu RevPAR y descubre si cobras de más o de menos.",
      ctaLabel: "Calcular mi tarifa ideal",
      href: "/herramientas/calculadora-tarifa",
    },
  },
  {
    area: "Control financiero",
    pregunta:
      "¿Sabes cuántas noches necesitas vender al mes para no perder dinero?",
    opciones: [
      { label: "La verdad, no lo sé", valor: 0 },
      { label: "Tengo una idea muy aproximada", valor: 50 },
      { label: "Lo sé más o menos", valor: 75 },
      { label: "Lo sé con precisión y lo reviso seguido", valor: 100 },
    ],
    recomendacion: {
      titulo: "No conoces tu punto de equilibrio",
      texto:
        "Si no sabes a partir de qué reserva empiezas a ganar, decides a ciegas. Es un número que todo hotelero debería traer en la cabeza.",
      ctaLabel: "Calcular mi punto de equilibrio",
      href: "/herramientas/punto-de-equilibrio",
    },
  },
  {
    area: "Gestión (PMS)",
    pregunta: "¿Cómo llevas tus reservas y tu disponibilidad?",
    opciones: [
      { label: "En cuaderno o de memoria", valor: 0 },
      { label: "En Excel o Google Sheets", valor: 40 },
      { label: "En las apps de cada OTA por separado", valor: 60 },
      { label: "En un solo sistema que junta todo", valor: 100 },
    ],
    recomendacion: {
      titulo: "Tus reservas viven en lugares dispersos",
      texto:
        "Llevar todo en cuaderno, Excel o en cada OTA por separado es la receta del overbooking y los errores. Un solo sistema junta reservas, disponibilidad y huéspedes.",
      ctaLabel: "Ver el sistema todo-en-uno",
      href: "/#contacto?utm_source=diagnostico",
    },
  },
  {
    area: "Facturación (CFDI)",
    pregunta: "¿Cómo facturas (CFDI) a tus huéspedes?",
    opciones: [
      { label: "Batallo, o lo hace alguien más cuando se acuerda", valor: 0 },
      { label: "En el portal del SAT, a mano, una por una", valor: 50 },
      { label: "Con un contador o un sistema aparte", valor: 75 },
      { label: "Se factura solo al confirmar la reserva", valor: 100 },
    ],
    recomendacion: {
      titulo: "Facturar te quita tiempo (y da errores)",
      texto:
        "Calcular el IVA y el Impuesto al Hospedaje y emitir el CFDI a mano, una por una, es lento y propenso a errores. Primero asegúrate de cobrar bien los impuestos.",
      ctaLabel: "Calcular IVA e Impuesto al Hospedaje",
      href: "/herramientas/calculadora-impuestos",
    },
  },
];

interface Nivel {
  titulo: string;
  mensaje: string;
  color: string;
  bg: string;
  koraTitulo: string;
  koraTexto: string;
}

function nivelPorPuntaje(p: number): Nivel {
  if (p <= 40) {
    return {
      titulo: "Dependiente de Booking",
      mensaje:
        "Tu hotel depende demasiado de las OTAs y se te están escapando reservas y dinero. La buena noticia: es justo lo que más rápido se puede arreglar.",
      color: "#B91C1C",
      bg: "#FEF2F2",
      koraTitulo: "Es momento de recuperar el control de tu hotel",
      koraTexto:
        "Kora te da reservas directas sin comisión, un agente de IA que contesta 24/7 y todo en una sola pantalla. Salir de la dependencia de Booking empieza aquí.",
    };
  }
  if (p <= 70) {
    return {
      titulo: "En transición",
      mensaje:
        "Vas por buen camino hacia la independencia, pero todavía dejas dinero sobre la mesa en algunos frentes. Con unos ajustes puedes dar el salto.",
      color: "#B45309",
      bg: "#FFFBEB",
      koraTitulo: "Estás cerca — Kora te da el empujón que falta",
      koraTexto:
        "Reservas directas, precio dinámico automático y facturación sin batallar. Kora junta las piezas que aún operas por separado.",
    };
  }
  return {
    titulo: "Dueño de tu demanda",
    mensaje:
      "Tienes buen control de tu hotel y dependes poco de las OTAs. Aún puedes afinar detalles para exprimir cada reserva al máximo.",
    color: "#1B4332",
    bg: "#F0FAF4",
    koraTitulo: "Lleva tu hotel al siguiente nivel",
    koraTexto:
      "Ya haces muchas cosas bien. Kora automatiza lo que aún haces a mano para que ganes tiempo y exprimas cada reserva, sin esfuerzo extra.",
  };
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function DiagnosticoHotel() {
  // step: 0..6 = preguntas, 7 = resultado
  const [step, setStep] = useState<number>(0);
  const [respuestas, setRespuestas] = useState<(number | null)[]>(
    Array(PREGUNTAS.length).fill(null)
  );

  const total = PREGUNTAS.length;
  const enResultado = step >= total;

  function elegir(valorIndex: number) {
    const nuevas = [...respuestas];
    nuevas[step] = valorIndex;
    setRespuestas(nuevas);
    // Avanza a la siguiente (o al resultado) con una pequeña pausa visual.
    setTimeout(() => setStep((s) => s + 1), 180);
  }

  function reiniciar() {
    setRespuestas(Array(total).fill(null));
    setStep(0);
  }

  // Puntaje = promedio de los valores elegidos.
  const valoresElegidos = respuestas.map((r, i) =>
    r === null ? 0 : PREGUNTAS[i].opciones[r].valor
  );
  const puntaje = Math.round(
    valoresElegidos.reduce((a, b) => a + b, 0) / total
  );
  const nivel = nivelPorPuntaje(puntaje);

  // Puntos débiles para el reporte personalizado.
  const debiles = PREGUNTAS.filter((_, i) => {
    const r = respuestas[i];
    return r !== null && PREGUNTAS[i].opciones[r].valor <= UMBRAL_DEBIL;
  });

  // ─── Pantalla de preguntas ───────────────────────────────────────────────
  if (!enResultado) {
    const q = PREGUNTAS[step];
    const progreso = ((step + 1) / total) * 100;

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="rounded-2xl border border-kora-primary overflow-hidden shadow-lg shadow-kora-primary/10">
            {/* Header + progreso */}
            <div className="bg-kora-primary px-6 py-5 sm:px-8 sm:py-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
                  {q.area}
                </span>
                <span className="text-xs font-semibold text-white/70">
                  Pregunta {step + 1} de {total}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-kora-accent"
                  initial={false}
                  animate={{ width: `${progreso}%` }}
                  transition={{ duration: 0.4, ease: EASE }}
                />
              </div>
            </div>

            {/* Pregunta + opciones */}
            <div className="bg-kora-bg p-6 sm:p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  <h2 className="text-lg sm:text-xl font-bold text-kora-text leading-snug">
                    {q.pregunta}
                  </h2>

                  <div className="mt-5 space-y-3" role="group" aria-label={q.pregunta}>
                    {q.opciones.map((opt, i) => {
                      const seleccionada = respuestas[step] === i;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => elegir(i)}
                          aria-pressed={seleccionada}
                          className={`btn-press w-full text-left px-5 py-4 rounded-xl border-2 text-sm sm:text-base font-medium transition-colors flex items-center justify-between gap-3 ${
                            seleccionada
                              ? "bg-kora-primary text-white border-kora-primary"
                              : "bg-white text-kora-text border-gray-200 hover:border-kora-accent"
                          }`}
                        >
                          <span>{opt.label}</span>
                          {seleccionada && (
                            <Check size={18} className="shrink-0" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navegación */}
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="btn-press inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-primary transition-colors disabled:opacity-0"
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Atrás
                </button>
                <span className="text-xs text-kora-muted">
                  Toca una respuesta para avanzar
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    );
  }

  // ─── Pantalla de resultado ───────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Puntaje */}
      <Reveal>
        <div
          className="rounded-2xl p-7 sm:p-9 border-2 text-center shadow-sm"
          style={{ background: nivel.bg, borderColor: nivel.color }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: nivel.color }}
          >
            Tu diagnóstico
          </p>
          <div className="flex items-end justify-center gap-1.5">
            <span
              className="text-6xl sm:text-7xl font-extrabold tabular-nums leading-none"
              style={{ color: nivel.color }}
            >
              {puntaje}
            </span>
            <span className="text-xl font-bold text-kora-muted mb-1.5">/100</span>
          </div>
          <p
            className="mt-3 text-xl sm:text-2xl font-bold"
            style={{ color: nivel.color }}
          >
            {nivel.titulo}
          </p>
          {/* Barra */}
          <div className="mt-4 h-2 w-full max-w-sm mx-auto rounded-full bg-black/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: nivel.color }}
              initial={{ width: 0 }}
              animate={{ width: `${puntaje}%` }}
              transition={{ duration: 0.7, ease: EASE }}
            />
          </div>
          <p className="mt-5 text-sm text-kora-text/75 leading-relaxed max-w-md mx-auto">
            {nivel.mensaje}
          </p>
          <button
            type="button"
            onClick={reiniciar}
            className="btn-press mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-muted hover:text-kora-primary transition-colors"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Volver a empezar
          </button>
        </div>
      </Reveal>

      {/* Reporte personalizado (puntos débiles + herramientas) */}
      {debiles.length > 0 && (
        <Reveal>
          <div className="mt-8">
            <h2 className="text-xl sm:text-2xl font-bold text-kora-text tracking-tight text-center">
              Por dónde empezar
            </h2>
            <p className="mt-2 text-sm text-kora-muted text-center max-w-md mx-auto">
              Según tus respuestas, estos son los frentes donde más rápido puedes
              ganar — con una herramienta gratis para cada uno.
            </p>
            <div className="mt-6 space-y-3">
              {debiles.map((q, i) => (
                <Reveal key={q.area} delay={0.05 + i * 0.06}>
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-bold text-kora-accent bg-kora-accent/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                      {q.area}
                    </span>
                    <h3 className="mt-2.5 font-bold text-kora-text text-base">
                      {q.recomendacion.titulo}
                    </h3>
                    <p className="mt-1.5 text-sm text-kora-muted leading-relaxed">
                      {q.recomendacion.texto}
                    </p>
                    <Link
                      href={q.recomendacion.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary hover:text-kora-primary-dark transition-colors"
                    >
                      {q.recomendacion.ctaLabel}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* CAPA 2: captura de lead */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Diagnóstico de dependencia de Booking"
            title="Recibe tu plan de acción personalizado"
            subtitle="Te mandamos por WhatsApp un plan a la medida de tu resultado para volver tu hotel menos dependiente de las OTAs."
            buttonText="Enviarme mi plan"
            hiddenFields={{
              puntaje: `${puntaje}/100`,
              nivel: nivel.titulo,
              puntos_debiles: debiles.map((d) => d.area).join(", ") || "Ninguno",
            }}
          />
        </div>
      </Reveal>

      {/* CAPA 3: el puente a Kora */}
      <Reveal>
        <div className="mt-10 rounded-2xl bg-kora-primary p-7 sm:p-9 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kora-accent/15 mb-4">
            <Sparkles size={14} className="text-kora-accent" aria-hidden="true" />
            <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
              Todo en un solo lugar
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            {nivel.koraTitulo}
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            {nivel.koraTexto}
          </p>
          <a
            href={`/?puntaje=${puntaje}&utm_source=diagnostico#contacto`}
            className="btn-press btn-arrow btn-fill mt-6 inline-flex items-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Ver cómo funciona Kora
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </Reveal>
    </div>
  );
}
