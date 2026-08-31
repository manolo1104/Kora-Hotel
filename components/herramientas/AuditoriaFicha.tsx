"use client";

import { useState } from "react";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Reveal } from "@/components/shared/Reveal";
import { LeadCaptureTool } from "@/components/herramientas/LeadCaptureTool";

const EASE = [0.23, 1, 0.32, 1] as const;

interface Item {
  texto: string;
  peso: number; // 3 = alta, 2 = media, 1 = baja prioridad
  tip: string;
}

const ITEMS: Item[] = [
  {
    texto: "Tienes 15 o más fotos de buena calidad (habitaciones, áreas comunes y fachada).",
    peso: 3,
    tip: "Las fotos son lo primero que mira el huésped. Sube al menos 15, con buena luz, e incluye baño, vista y zonas comunes.",
  },
  {
    texto: "Tu calificación promedio es buena (8.5+ en Booking / 4.3+ en Google).",
    peso: 3,
    tip: "La calificación define cuánto te muestran. Pide reseñas a los huéspedes contentos al hacer check-out para subir tu promedio.",
  },
  {
    texto: "Respondes todas las reseñas, buenas y malas.",
    peso: 3,
    tip: "Responder reseñas (sobre todo las malas, con calma) mejora tu posicionamiento y da confianza a quien duda.",
  },
  {
    texto: "Tus precios y disponibilidad están siempre actualizados.",
    peso: 3,
    tip: "Un calendario desactualizado genera cancelaciones y te baja en el ranking. Mantenlo al día en todos los canales.",
  },
  {
    texto: "Tienes una forma de reservar directo contigo (página o WhatsApp visible).",
    peso: 3,
    tip: "Tu mejor ficha es la tuya: un canal directo te ahorra la comisión y te deja la relación con el huésped.",
  },
  {
    texto: "Tu descripción dice qué te hace único y qué hay cerca.",
    peso: 2,
    tip: "Más allá de 'cómodas habitaciones', cuenta tu diferencia y los atractivos de la zona. Ayuda a rankear y a convencer.",
  },
  {
    texto: "Listas todas tus amenidades (wifi, estacionamiento, A/C, mascotas, etc.).",
    peso: 2,
    tip: "Cada amenidad marcada es un filtro de búsqueda en el que apareces. No dejes ninguna sin marcar.",
  },
  {
    texto: "Tus datos de contacto están completos y correctos (teléfono, WhatsApp, horarios).",
    peso: 2,
    tip: "Sobre todo en Google: datos incompletos o erróneos te bajan en resultados locales y te hacen perder llamadas.",
  },
  {
    texto: "Tu ubicación en el mapa es exacta.",
    peso: 2,
    tip: "Un pin mal puesto confunde al huésped y te quita relevancia en las búsquedas 'cerca de mí'.",
  },
  {
    texto: "Tienes una política de cancelación clara.",
    peso: 2,
    tip: "Reglas claras reducen disputas y dan seguridad para reservar. Defínelas y muéstralas.",
  },
  {
    texto: "Tus fotos son recientes (de menos de un año).",
    peso: 1,
    tip: "Renueva fotos al menos una vez al año; lo nuevo genera más interés y refleja cómo luce hoy tu hotel.",
  },
  {
    texto: "Publicas novedades u ofertas con frecuencia (Google Posts, ofertas Booking).",
    peso: 1,
    tip: "Mantener actividad en tu ficha le indica a la plataforma que estás activo y te ayuda a aparecer más.",
  },
];

const PESO_TOTAL = ITEMS.reduce((a, it) => a + it.peso, 0);

function prioridadLabel(peso: number): string {
  return peso === 3 ? "Prioridad alta" : peso === 2 ? "Prioridad media" : "Prioridad baja";
}

interface Nivel {
  titulo: string;
  color: string;
  bg: string;
}

function nivelPorPuntaje(p: number): Nivel {
  if (p < 50)
    return { titulo: "Tu ficha necesita trabajo", color: "#B91C1C", bg: "#FEF2F2" };
  if (p < 80)
    return { titulo: "Vas por buen camino", color: "#B45309", bg: "#FFFBEB" };
  return { titulo: "Tu ficha está muy bien", color: "#1B4332", bg: "#F0FAF4" };
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function AuditoriaFicha() {
  const [marcados, setMarcados] = useState<boolean[]>(
    Array(ITEMS.length).fill(false)
  );

  function toggle(i: number) {
    setMarcados((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  const pesoLogrado = ITEMS.reduce(
    (a, it, i) => a + (marcados[i] ? it.peso : 0),
    0
  );
  const puntaje = Math.round((pesoLogrado / PESO_TOTAL) * 100);
  const nivel = nivelPorPuntaje(puntaje);

  // Pendientes ordenados por prioridad (peso desc).
  const pendientes = ITEMS.map((it, i) => ({ it, i }))
    .filter(({ i }) => !marcados[i])
    .sort((a, b) => b.it.peso - a.it.peso);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* ── CAPA 1: checklist + puntaje ── */}
      <Reveal>
        <div className="rounded-2xl border border-kora-primary overflow-hidden shadow-lg shadow-kora-primary/10">
          <div className="bg-kora-primary px-6 py-5 sm:px-8 sm:py-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Marca lo que ya tiene tu ficha
            </h2>
            <p className="mt-1 text-kora-accent text-sm">
              Aplica a tu perfil de Booking, Airbnb o Google
            </p>
          </div>

          <div className="bg-kora-bg p-6 sm:p-8">
            {/* Puntaje en vivo */}
            <div
              className="rounded-xl p-5 border-2 text-center mb-6"
              style={{ background: nivel.bg, borderColor: nivel.color }}
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="flex items-end justify-center gap-1.5">
                <span
                  className="text-5xl sm:text-6xl font-extrabold tabular-nums leading-none"
                  style={{ color: nivel.color }}
                >
                  {puntaje}
                </span>
                <span className="text-lg font-bold text-kora-muted mb-1">/100</span>
              </div>
              <p className="mt-2 text-base sm:text-lg font-bold" style={{ color: nivel.color }}>
                {nivel.titulo}
              </p>
              <div className="mt-3 h-2 w-full max-w-xs mx-auto rounded-full bg-black/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: nivel.color }}
                  initial={false}
                  animate={{ width: `${puntaje}%` }}
                  transition={{ duration: 0.4, ease: EASE }}
                />
              </div>
            </div>

            {/* Checklist */}
            <ul className="space-y-2.5" aria-label="Lista de verificación de tu ficha">
              {ITEMS.map((it, i) => {
                const on = marcados[i];
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => toggle(i)}
                      aria-pressed={on}
                      className={`btn-press w-full text-left px-4 py-3.5 rounded-xl border-2 flex items-start gap-3 transition-colors ${
                        on
                          ? "bg-white border-kora-accent"
                          : "bg-white border-gray-200 hover:border-kora-accent/60"
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 border-2 transition-colors ${
                          on
                            ? "bg-kora-accent border-kora-accent"
                            : "bg-white border-gray-300"
                        }`}
                        aria-hidden="true"
                      >
                        {on && <Check size={13} className="text-kora-primary" />}
                      </span>
                      <span
                        className={`text-sm leading-snug ${
                          on ? "text-kora-text" : "text-kora-text"
                        }`}
                      >
                        {it.texto}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Reveal>

      {/* Por mejorar */}
      {pendientes.length > 0 && (
        <Reveal>
          <div className="mt-8">
            <h2 className="text-xl sm:text-2xl font-bold text-kora-text tracking-tight text-center">
              Por mejorar
            </h2>
            <p className="mt-2 text-sm text-kora-muted text-center max-w-md mx-auto">
              Empieza por lo de prioridad alta: es lo que más mueve tu visibilidad
              y tus reservas.
            </p>
            <div className="mt-6 space-y-3">
              {pendientes.map(({ it, i }, idx) => (
                <Reveal key={i} delay={0.04 + idx * 0.04}>
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <span
                      className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest"
                      style={
                        it.peso === 3
                          ? { color: "#B91C1C", background: "#FEF2F2" }
                          : it.peso === 2
                            ? { color: "#B45309", background: "#FFFBEB" }
                            : { color: "#6B7280", background: "#F3F4F6" }
                      }
                    >
                      {prioridadLabel(it.peso)}
                    </span>
                    <p className="mt-2 font-bold text-kora-text text-sm">{it.texto}</p>
                    <p className="mt-1 text-sm text-kora-muted leading-relaxed">
                      {it.tip}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* ── CAPA 2: captura de lead ── */}
      <Reveal>
        <div className="mt-10">
          <LeadCaptureTool
            herramienta="Auditoría de ficha (Booking/Google)"
            title="Recibe tu plan para mejorar tu ficha"
            subtitle="Te mandamos por WhatsApp los pasos concretos para subir tu visibilidad en Booking y Google según lo que te falta."
            buttonText="Enviarme mi plan"
            hiddenFields={{
              puntaje: `${puntaje}/100`,
              nivel: nivel.titulo,
              pendientes_alta: pendientes
                .filter((p) => p.it.peso === 3)
                .length.toString(),
            }}
          />
        </div>
      </Reveal>

      {/* ── CAPA 3: el puente a Kora ── */}
      <Reveal>
        <div className="mt-10 rounded-2xl bg-kora-primary p-7 sm:p-9 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kora-accent/15 mb-4">
            <Sparkles size={14} className="text-kora-accent" aria-hidden="true" />
            <span className="text-xs font-bold text-kora-accent uppercase tracking-widest">
              Tu mejor ficha es la tuya
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Mejora tu ficha… y ten también la tuya propia
          </h2>
          <p className="mt-3 text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
            Optimizar Booking y Google está muy bien, pero ahí sigues pagando
            comisión y compartiendo a tu huésped. Con Kora tienes tu propia página
            de reservas directas y un agente que contesta 24/7 — el canal que sí es
            100% tuyo.
          </p>
          <a
            href="/?utm_source=auditoria-ficha#contacto"
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
