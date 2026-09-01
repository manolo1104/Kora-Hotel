"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CASO,
  OTA_ANTES,
  OTA_DESPUES,
  DIRECTO_ANTES,
  DIRECTO_DESPUES,
  MESES,
  COMISION_OTA,
  AHORRO_MENSUAL,
  AHORRO_ANUAL,
  AHORRO_NETO_ANUAL,
  COSTO_KORA_ANUAL,
  VECES_SE_PAGA,
  CRECIMIENTO_DIRECTAS,
  RESPUESTA_ANTES,
  RESPUESTA_DESPUES,
  IMPLEMENTACION_HORAS,
  mxn,
  mxnLargo,
} from "@/lib/caso-paraiso";

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
          El Paraíso Encantado son {CASO.habitaciones} habitaciones en Xilitla,
          en el corazón de la Huasteca Potosina. Destino con demanda de sobra y
          un hotel del que estoy orgulloso. Y aun así, cada mes firmaba el mismo
          trato sin haberlo negociado: {OTA_ANTES} de cada 100 reservas entraban
          por Booking o Airbnb, y de cada una de esas se iba el{" "}
          {COMISION_OTA}% antes de que el huésped cruzara la puerta.
        </p>
        <p className="text-kora-muted leading-relaxed mt-4">
          Lo que más me pesaba no era la comisión. Era no saber. No tenía forma
          de contestar, un martes cualquiera, cuánto llevaba pagado de comisión
          ese mes ni cuántos mensajes de WhatsApp se habían quedado sin
          respuesta la noche anterior.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            metric: `${OTA_ANTES}%`,
            label: "de reservas venían de Booking o Airbnb",
            bad: true,
          },
          {
            metric: `${COMISION_OTA}%`,
            label: "de comisión promedio por cada reserva OTA",
            bad: true,
          },
          {
            metric: RESPUESTA_ANTES,
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
              title: "Sin un lugar donde estuviera todo",
              desc: "Las reservas llegaban por Booking, por WhatsApp y por teléfono, y vivían en tres sitios distintos. Para saber si el fin de semana estaba lleno había que cruzar la extranet, la libreta y un Excel. Dos personas vendiendo el mismo cuarto era cuestión de tiempo.",
            },
            {
              title: "El WhatsApp se apagaba a las diez de la noche",
              desc: "Las consultas llegan cuando la gente planea su viaje: de noche, en domingo, en puente. Contestar a la mañana siguiente casi nunca sirve — para entonces ya reservaron en la siguiente opción de Booking. Cada mensaje dormido era una reserva regalada a la competencia.",
            },
            {
              title: "Decidir el precio a ojo",
              desc: "Sin saber qué habitación deja más, qué canal cuesta más ni cómo va la ocupación de la semana, subir o bajar la tarifa es una corazonada. Y una corazonada equivocada en temporada alta no se recupera: esa noche ya no vuelve.",
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
      day: "Hora 0",
      title: "La lista de lo que dolía",
      desc: "Tres problemas, escritos en una hoja: dependencia de las OTAs, WhatsApp sin contestar y no saber los números. Todo lo que no estuviera en esa hoja quedó fuera del arranque — es la única forma de que un arranque dure horas y no meses.",
    },
    {
      day: "Hora 6",
      title: "El hotel, cargado",
      desc: "Las 15 habitaciones con sus tipos, las fotos, las tarifas por temporada, las políticas de cancelación y lo que Camila tiene que saber contestar. Yo no toqué nada técnico: mandé fotos y precios por WhatsApp.",
    },
    {
      day: "Hora 16",
      title: "Las reservas que ya existían",
      desc: "Lo que estaba en Booking, en el Excel y en la libreta se pasó al sistema. Ninguna se perdió, y el historial de huéspedes quedó adentro desde el primer día — eso es lo que después deja que un huésped repita sin pasar por una OTA.",
    },
    {
      day: `Hora ${IMPLEMENTACION_HORAS}`,
      title: "Operando, y el equipo capacitado",
      desc: "Videollamada de 40 minutos con mi recepcionista: mapa de habitaciones, check-in, reservas entrantes y qué hacer con los casos raros. Al colgar, el motor ya estaba cobrando y Camila ya estaba contestando.",
    },
    {
      day: "Semana 1",
      title: "La primera reserva sin comisión",
      desc: "A los cuatro días entró la primera reserva directa, sin intermediario. La segunda la cerró Camila sola, a las 11:30 de la noche de un viernes — la hora exacta a la que antes se me escapaban.",
    },
    {
      day: "Mes 1",
      title: "Los números, por fin",
      desc: "Reservas por canal, tiempo de respuesta y comisión pagada contra el mes anterior, en una pantalla. Es la primera vez que pude contestar «¿cómo vamos?» sin abrir tres sitios.",
    },
  ];

  return (
    <div className="space-y-8">
      <p className="text-kora-muted leading-relaxed">
        De la primera conversación al sistema cobrando pasaron{" "}
        {IMPLEMENTACION_HORAS} horas. No es una cifra de folleto: es el mismo
        arranque que hacemos hoy en cada hotel, y así fue paso a paso.
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
          Lo que mi recepcionista tuvo que aprender: tres cosas
        </p>
        <p className="text-sm text-kora-muted leading-relaxed">
          Hacer check-in, leer el mapa de habitaciones y distinguir una reserva
          directa de una de OTA. Nada más. Si un sistema para un hotel de{" "}
          {CASO.habitaciones} cuartos necesita un manual, el sistema está mal
          hecho.
        </p>
      </div>
    </div>
  );
}

function TabResultados() {
  return (
    <div className="space-y-8">
      <p className="text-kora-muted leading-relaxed">
        A los {MESES} meses tenía, por primera vez, números que mirar. No son
        proyecciones ni un caso de otro hotel: son los míos, y son los que
        aparecen en todo lo demás que dice este sitio.
      </p>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            metric: `${OTA_ANTES}% → ${OTA_DESPUES}%`,
            label: `Dependencia de las OTAs, en ${MESES} meses`,
          },
          {
            metric: mxn(AHORRO_MENSUAL),
            label: "MXN al mes que dejé de pagar en comisiones",
          },
          {
            metric: "<30 seg",
            label: `Respuesta en WhatsApp (antes: ${RESPUESTA_ANTES})`,
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
                  <span className="font-bold text-red-600">{OTA_ANTES}%</span>
                </div>
                <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-red-400 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${OTA_ANTES}%` }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
                    viewport={{ once: true }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-kora-muted mb-1">
                  <span>Reserva directa</span>
                  <span className="font-bold">{DIRECTO_ANTES}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gray-300 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${DIRECTO_ANTES}%` }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
                    viewport={{ once: true }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-kora-accent/5 border border-kora-accent/20 rounded-2xl p-5">
            <p className="text-xs font-bold text-kora-primary uppercase tracking-widest mb-3">
              Con Kora (mes {MESES})
            </p>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs text-kora-muted mb-1">
                  <span>Booking / Airbnb</span>
                  <span className="font-bold text-kora-muted">{OTA_DESPUES}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-kora-muted/40 rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${OTA_DESPUES}%` }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
                    viewport={{ once: true }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-kora-muted mb-1">
                  <span>Reserva directa</span>
                  <span className="font-bold text-kora-primary">{DIRECTO_DESPUES}%</span>
                </div>
                <div className="h-2 bg-kora-accent/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-kora-accent rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${DIRECTO_DESPUES}%` }}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
                    viewport={{ once: true }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial impact */}
      <div className="bg-kora-bg rounded-2xl p-6 border border-gray-100">
        <h4 className="font-bold text-kora-text mb-1">
          La cuenta, completa
        </h4>
        <p className="text-xs text-kora-muted mb-4 leading-relaxed">
          Es la comisión que ya no pago porque esas reservas entran directas —
          por el motor, por WhatsApp o por teléfono— calculada al{" "}
          {COMISION_OTA}% que me cobraban en promedio las OTAs.
        </p>
        <div className="space-y-3 text-sm">
          {/*
            TODA esta tabla se calcula desde lib/caso-paraiso.ts, que a su vez
            saca el precio de lib/oferta.ts. Ninguna cifra se escribe a mano.
            Historia de por qué: primero el ahorro neto estaba escrito a mano y
            decía $35,880 al año — 5.4 veces el precio real (K-38), o sea el caso
            se equivocaba EN CONTRA. Después la landing publicaba "≈$30,000" para
            el mismo ahorro que aquí valía $8,400 al mes. Un caso de éxito que no
            cuadra consigo mismo destruye el resto de la página: quien saca la
            cuenta deja de creer todo lo demás.
          */}
          {[
            { label: "Comisión de OTA que dejé de pagar (mensual)", value: mxnLargo(AHORRO_MENSUAL), positive: true },
            { label: "Lo mismo, al año", value: mxnLargo(AHORRO_ANUAL), positive: true },
            {
              label: "Lo que cuesta Kora al año",
              value: `− ${mxnLargo(COSTO_KORA_ANUAL)}`,
              positive: false,
            },
            {
              label: "Lo que se queda en el hotel",
              value: mxnLargo(AHORRO_NETO_ANUAL),
              positive: true,
              bold: true,
            },
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

      {/* Lo que la tabla no dice: el volumen también creció. Va aquí y no
          arriba como métrica suelta porque "+40%" pegado al "40%" de
          dependencia OTA se leía como la misma cifra dos veces. */}
      <div>
        <h4 className="font-bold text-kora-text mb-3">
          Y no fue repartir el mismo pastel
        </h4>
        <p className="text-kora-muted leading-relaxed text-sm">
          Bajar del {OTA_ANTES}% al {OTA_DESPUES}% de dependencia podría
          significar simplemente vender menos por Booking. No fue el caso: contra
          el mismo periodo del año anterior, las reservas directas crecieron un{" "}
          <span className="font-semibold text-kora-text">
            {CRECIMIENTO_DIRECTAS}% en volumen
          </span>
          . La mayor parte de ese crecimiento entró por la puerta que antes
          estaba cerrada de noche: WhatsApp contestado en{" "}
          {RESPUESTA_DESPUES} en vez de {RESPUESTA_ANTES}.
        </p>
      </div>

      <blockquote className="border-l-4 border-kora-accent pl-5">
        <p className="text-kora-text leading-relaxed italic">
          &ldquo;Lo que más me sorprendió fue ver reservas llegando de noche por
          WhatsApp que antes simplemente no llegaban. No es que haya más tráfico
          al hotel: es que ahora podemos atenderlo.&rdquo;
        </p>
        <footer className="mt-3 text-sm font-semibold text-kora-primary">
          {CASO.duenoNombre}, {CASO.hotel}
        </footer>
      </blockquote>

      {/* El remate del caso: la comparación que el hotelero puede hacer solo. */}
      <div className="rounded-2xl bg-kora-primary p-6 text-white">
        <p className="text-sm text-white/80 leading-relaxed">
          Puesto de otra forma: lo que este hotel deja de dar en comisiones al
          año paga Kora{" "}
          <span className="font-bold text-kora-accent">
            {VECES_SE_PAGA} veces
          </span>
          . El resto se queda en el hotel.
        </p>
      </div>
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
            className={`relative flex-1 py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors duration-200 ${
              active === tab.id
                ? "text-kora-primary"
                : "text-kora-muted hover:text-kora-text"
            }`}
          >
            {active === tab.id && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 bg-white rounded-xl shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab panels — crossfade on switch */}
      {/*
        🔴 LAS PESTAÑAS ESTABAN MUERTAS EN LA PÁGINA PÚBLICA. Con `mode="wait"`,
        AnimatePresence espera a que el panel que sale termine su `exit` antes de
        montar el que entra — y ese `exit` no terminaba nunca. Efecto para el
        visitante: pulsa "Los resultados", el botón se marca como activo
        (`aria-selected` pasa a true) y el contenido se queda en "El problema"
        para siempre. Las dos terceras partes del caso de estudio eran
        inalcanzables, incluido el bloque de impacto financiero de aquí abajo.

        Medido en localhost el 26 ago 2026 sobre la versión desplegada: tras
        pulsar, el panel seguía siendo `panel-problema`. Comprobado que NO lo
        causaba ningún cambio de esta sesión (se revirtió el archivo y el defecto
        seguía). Probado también que la causa no era el `transform` en cadena:
        cambiarlo por `y` no arregló nada; lo que lo arregla es no usar
        `mode="wait"`. `popLayout` saca de flujo al que sale, así que no hay
        salto de maquetación mientras se cruzan.
      */}
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={active}
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
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
