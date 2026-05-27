"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const EASE = [0.23, 1, 0.32, 1] as const;

const tabs = [
  { id: "problema", label: "El problema" },
  { id: "implementacion", label: "La implementación" },
  { id: "resultados", label: "Los resultados" },
];

// ─── Tab content ──────────────────────────────────────────────────────────────

function TabProblema() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold text-kora-text mb-4">
          Antes de Kora: operar a ciegas
        </h3>
        <p className="text-kora-muted leading-relaxed">
          Hotel Paraíso Encantado es un hotel boutique de naturaleza en Xilitla,
          San Luis Potosí, en el corazón de la Huasteca Potosina. Con 15
          habitaciones y una propuesta única en un destino de alta demanda,
          Manolo Covarrubias enfrentaba el problema que tiene la mayoría de los
          hoteles boutique en México: demasiada dependencia de las OTAs y
          demasiado poco control de su propio negocio.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            metric: "75%",
            label: "de reservas venían de Booking o Airbnb",
            bad: true,
          },
          {
            metric: "18%",
            label: "de comisión promedio por cada reserva OTA",
            bad: true,
          },
          {
            metric: "4+ hrs",
            label: "tiempo promedio de respuesta en WhatsApp",
            bad: true,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-red-50 border border-red-100 rounded-2xl p-5"
          >
            <p className="text-2xl font-bold text-red-600">{item.metric}</p>
            <p className="text-sm text-red-700/80 mt-1 leading-snug">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h4 className="font-bold text-kora-text mb-3">
          Tres problemas operativos concretos
        </h4>
        <ul className="space-y-4">
          {[
            {
              title: "Sin sistema de reservas propio",
              desc: "Las reservas llegaban por Booking, por WhatsApp manual y por llamada telefónica. No había un lugar centralizado donde ver la ocupación real. Las dobles reservas eran un riesgo constante.",
            },
            {
              title: "WhatsApp sin respuesta automática",
              desc: "Las consultas llegaban de noche, los fines de semana, en días festivos. Sin nadie contestando, los huéspedes potenciales se iban a la siguiente opción en Booking. Cada mensaje sin respuesta era una reserva perdida.",
            },
            {
              title: "Sin visibilidad financiera",
              desc: "No había forma rápida de saber cuánto se estaba pagando en comisiones al mes, qué habitaciones eran más rentables o cuál era la ocupación real de la semana. Las decisiones se tomaban por intuición, no por datos.",
            },
          ].map((item) => (
            <li key={item.title} className="flex gap-4">
              <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 mt-2" />
              <div>
                <p className="font-semibold text-kora-text text-sm">
                  {item.title}
                </p>
                <p className="text-sm text-kora-muted mt-1 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <blockquote className="border-l-4 border-kora-primary/30 pl-5">
        <p className="text-kora-text leading-relaxed italic">
          &ldquo;Diseñé Kora para mi propio hotel porque no encontré nada que
          realmente funcionara para hoteles como el nuestro. Todo lo que existía
          era demasiado caro, demasiado complejo, o no estaba pensado para
          México.&rdquo;
        </p>
        <footer className="mt-3 text-sm font-semibold text-kora-primary">
          Manolo Covarrubias, fundador de Kora
        </footer>
      </blockquote>
    </div>
  );
}

function TabImplementacion() {
  const timeline = [
    {
      day: "Día 0",
      title: "Primera conversación",
      desc: "Manolo nos describió los tres problemas principales: dependencia de OTAs, WhatsApp sin respuesta y falta de visibilidad. En 15 minutos definimos el scope de implementación.",
    },
    {
      day: "Día 1",
      title: "Configuración del sistema",
      desc: "Kora fue configurado desde cero para el hotel: habitaciones, tipos, tarifas por temporada, políticas de cancelación, respuestas del agente de WhatsApp y conexión con Booking y Airbnb.",
    },
    {
      day: "Día 2",
      title: "Migración de reservas",
      desc: "Todas las reservas existentes en Booking, WhatsApp y el Excel del hotel fueron importadas al nuevo PMS. Ninguna reserva se perdió en el proceso. El historial de huéspedes quedó disponible desde el primer día.",
    },
    {
      day: "Día 3",
      title: "Capacitación del equipo",
      desc: "Video llamada de 40 minutos con Manolo y su recepcionista. Recorrido completo: cómo ver el mapa de habitaciones, cómo hacer check-in, cómo ver las reservas entrantes y cómo manejar casos especiales.",
    },
    {
      day: "Semana 1",
      title: "Primera reserva directa por Kora",
      desc: "A los 4 días de lanzar el motor de reservas, llegó la primera reserva directa sin intermediario. El agente de WhatsApp cerró la segunda reserva directa a las 11:30 de la noche del viernes.",
    },
    {
      day: "Mes 1",
      title: "Revisión de resultados",
      desc: "Revisamos los números juntos: reservas por canal, tiempo de respuesta, comisiones pagadas vs. mes anterior. Los primeros resultados fueron mejores de lo esperado.",
    },
  ];

  return (
    <div className="space-y-8">
      <p className="text-kora-muted leading-relaxed">
        La implementación de Kora en Hotel Paraíso Encantado tomó 72 horas
        desde la primera conversación hasta el sistema operando en producción.
        Así fue el proceso, paso a paso.
      </p>

      <ol className="relative space-y-0">
        {timeline.map((item, i) => (
          <li key={i} className="flex gap-5 pb-8 last:pb-0 relative">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-kora-primary flex items-center justify-center flex-shrink-0 z-10">
                <span className="text-white text-xs font-bold">{i + 1}</span>
              </div>
              {i < timeline.length - 1 && (
                <div className="w-px flex-1 bg-kora-primary/15 mt-2" />
              )}
            </div>
            <div className="pb-2 pt-1.5">
              <span className="text-xs font-bold text-kora-accent bg-kora-accent/10 px-2.5 py-0.5 rounded-full">
                {item.day}
              </span>
              <h4 className="font-bold text-kora-text mt-2 mb-1">
                {item.title}
              </h4>
              <p className="text-sm text-kora-muted leading-relaxed">
                {item.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="bg-kora-bg rounded-2xl p-6 border border-gray-100">
        <p className="text-sm font-bold text-kora-text mb-1">
          Lo que el equipo necesitaba saber antes de arrancar
        </p>
        <p className="text-sm text-kora-muted leading-relaxed">
          Cómo hacer check-in digital, cómo ver el mapa de habitaciones y cómo
          identificar una reserva directa vs. una de OTA. Todo lo demás lo hace
          el sistema automáticamente.
        </p>
      </div>
    </div>
  );
}

function TabResultados() {
  return (
    <div className="space-y-8">
      <p className="text-kora-muted leading-relaxed">
        A los tres meses de implementar Kora, Hotel Paraíso Encantado operaba
        con números que no había tenido antes. Estos son los resultados reales.
      </p>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            metric: "+40%",
            label: "Reservas directas vs. el mismo período del año anterior",
          },
          {
            metric: "$8,400",
            label: "MXN/mes ahorrados en comisiones OTA (promedio)",
          },
          {
            metric: "<30 seg",
            label: "Tiempo de respuesta en WhatsApp (antes: 4+ horas)",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-kora-primary rounded-2xl p-5 text-white"
          >
            <p className="text-2xl font-bold text-kora-accent">{item.metric}</p>
            <p className="text-sm text-white/70 mt-1 leading-snug">
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {/* Before / after */}
      <div>
        <h4 className="font-bold text-kora-text mb-4">
          Antes vs. después: por canal de reserva
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
            <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-3">
              Antes de Kora
            </p>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs text-kora-muted mb-1">
                  <span>Booking / Airbnb</span>
                  <span className="font-bold text-red-600">75%</span>
                </div>
                <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: "75%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-kora-muted mb-1">
                  <span>Reserva directa</span>
                  <span className="font-bold">25%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-300 rounded-full" style={{ width: "25%" }} />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-kora-accent/5 border border-kora-accent/20 rounded-2xl p-5">
            <p className="text-xs font-bold text-kora-primary uppercase tracking-widest mb-3">
              Con Kora (mes 3)
            </p>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs text-kora-muted mb-1">
                  <span>Booking / Airbnb</span>
                  <span className="font-bold text-kora-muted">53%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-kora-muted/40 rounded-full" style={{ width: "53%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-kora-muted mb-1">
                  <span>Reserva directa</span>
                  <span className="font-bold text-kora-primary">47%</span>
                </div>
                <div className="h-2 bg-kora-accent/20 rounded-full overflow-hidden">
                  <div className="h-full bg-kora-accent rounded-full" style={{ width: "47%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial impact */}
      <div className="bg-kora-bg rounded-2xl p-6 border border-gray-100">
        <h4 className="font-bold text-kora-text mb-4">Impacto financiero anual</h4>
        <div className="space-y-3 text-sm">
          {[
            { label: "Ahorro en comisiones OTA (mensual)", value: "$8,400 MXN", positive: true },
            { label: "Ahorro en comisiones OTA (anual)", value: "$100,800 MXN", positive: true },
            { label: "Costo de Kora (anual)", value: "$35,880 MXN", positive: false },
            { label: "Ahorro neto anual", value: "$64,920 MXN", positive: true, bold: true },
          ].map((row) => (
            <div
              key={row.label}
              className={`flex justify-between items-center py-2 border-b border-gray-100 last:border-0 ${row.bold ? "font-bold" : ""}`}
            >
              <span className="text-kora-text">{row.label}</span>
              <span className={row.positive ? "text-kora-primary" : "text-kora-muted"}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <blockquote className="border-l-4 border-kora-accent pl-5">
        <p className="text-kora-text leading-relaxed italic">
          &ldquo;Lo que más me sorprendió fue ver reservas llegando de noche por
          WhatsApp que antes simplemente no llegaban. No es que haya más tráfico
          al hotel: es que ahora podemos atenderlo.&rdquo;
        </p>
        <footer className="mt-3 text-sm font-semibold text-kora-primary">
          Manolo Covarrubias, Hotel Paraíso Encantado
        </footer>
      </blockquote>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CasoTabs() {
  const [active, setActive] = useState("problema");

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex gap-1 bg-kora-bg rounded-2xl p-1.5 mb-8"
        role="tablist"
        aria-label="Secciones del caso de estudio"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
              active === tab.id
                ? "bg-white text-kora-primary shadow-sm"
                : "text-kora-muted hover:text-kora-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels — crossfade on switch */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          initial={{ opacity: 0, transform: "translateY(10px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={{ opacity: 0, transform: "translateY(-4px)" }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          {active === "problema" && <TabProblema />}
          {active === "implementacion" && <TabImplementacion />}
          {active === "resultados" && <TabResultados />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
