"use client";

// La primera pestaña: qué le falta a la asistente, en orden de importancia, con
// UN botón por cosa. Sustituye a la barra «Salud de Camila — X%», que contaba
// como hecho lo que venía de fábrica (el interruptor encendido), exigía fotos
// que el bot no usa, y no decía qué hacer.

import { Check, ChevronRight, MessageCircle, QrCode, Sparkles, BookOpen, BellRing, BedDouble } from "lucide-react";
import { Tarjeta } from "@/components/panel/ui";
import type { Seccion } from "../tipos";

export interface Pendiente {
  id: string;
  hecho: boolean;
  titulo: string;
  detalle: string;
  icono: React.ReactNode;
  ir: { seccion?: Seccion; href?: string; abrirChat?: boolean };
}

export function pendientesDe(o: {
  nombreBot: string;
  slug: string;
  conectada: boolean;
  personalidad: boolean;
  basicos: boolean;
  cuartosConPrecio: boolean;
  avisoConfigurado: boolean;
  probada: boolean;
}): Pendiente[] {
  const n = o.nombreBot;
  return [
    {
      id: "cuartos",
      hecho: o.cuartosConPrecio,
      titulo: "Tus cuartos y precios",
      detalle: `Sin cuartos con precio, ${n} no puede cotizar.`,
      icono: <BedDouble size={16} />,
      ir: { href: `/panel/${o.slug}/sitio?tab=habitaciones` },
    },
    {
      id: "basicos",
      hecho: o.basicos,
      titulo: "Lo básico de tu hotel",
      detalle: "Dirección, horarios de entrada y salida, y formas de pago.",
      icono: <BookOpen size={16} />,
      ir: { seccion: "sabe" },
    },
    {
      id: "persona",
      hecho: o.avisoConfigurado,
      titulo: "A quién avisar cuando necesite a una persona",
      detalle: "Para quejas, comprobantes de pago o grupos grandes.",
      icono: <BellRing size={16} />,
      ir: { seccion: "vende" },
    },
    {
      id: "personalidad",
      hecho: o.personalidad,
      titulo: `Cómo habla ${n}`,
      detalle: "Elige su estilo y su saludo.",
      icono: <Sparkles size={16} />,
      ir: { seccion: "personalidad" },
    },
    {
      id: "probar",
      hecho: o.probada,
      titulo: "Pruébala",
      detalle: "Hazle 3 preguntas como si fueras un huésped.",
      icono: <MessageCircle size={16} />,
      ir: { abrirChat: true },
    },
    {
      id: "conectar",
      hecho: o.conectada,
      titulo: "Conecta tu WhatsApp",
      detalle: "Escanea un código una sola vez y empieza a contestar.",
      icono: <QrCode size={16} />,
      ir: { seccion: "whatsapp" },
    },
  ];
}

export default function Resumen({
  pendientes,
  nombreBot,
  onIr,
}: {
  pendientes: Pendiente[];
  nombreBot: string;
  onIr: (p: Pendiente) => void;
}) {
  const hechos = pendientes.filter((p) => p.hecho).length;
  const todo = hechos === pendientes.length;
  return (
    <div className="space-y-5">
      <Tarjeta
        titulo={todo ? `${nombreBot} está lista` : `Para que ${nombreBot} quede lista`}
        descripcion={
          todo
            ? "Todo en orden. Revisa de vez en cuando sus conversaciones y enséñale con «Corregir» si algo no le salió bien."
            : `Llevas ${hechos} de ${pendientes.length}. Cada cosa toma un par de minutos.`
        }
      >
        <div
          className="mb-4 h-2 overflow-hidden rounded-full bg-panel-contrast/10"
          role="progressbar"
          aria-valuenow={hechos}
          aria-valuemin={0}
          aria-valuemax={pendientes.length}
          aria-label="Avance de la configuración"
        >
          <div
            className="h-full origin-left rounded-full bg-kora-accent transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${hechos / pendientes.length})` }}
          />
        </div>
        <ul className="space-y-2">
          {pendientes.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onIr(p)}
                className={`btn-press group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                  p.hecho ? "border-transparent bg-kora-bg" : "border-panel-border hover:border-kora-primary/50"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                    p.hecho ? "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-text)]" : "bg-kora-primary/10 text-kora-primary"
                  }`}
                >
                  {p.hecho ? <Check size={15} /> : p.icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${p.hecho ? "text-kora-muted" : "text-kora-text"}`}>{p.titulo}</span>
                  {!p.hecho && <span className="block text-xs text-kora-muted">{p.detalle}</span>}
                </span>
                <span className="sr-only">{p.hecho ? "(listo)" : "(pendiente)"}</span>
                <ChevronRight size={16} className="shrink-0 text-kora-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <Tarjeta titulo="Cómo trabaja">
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            ["Contesta", "Con los datos de tu hotel. Si no sabe algo, no lo inventa."],
            ["Cotiza y cobra", "Con disponibilidad y precios reales. Manda link de pago y aparta el cuarto."],
            ["Te avisa", "Cuando algo necesita a una persona, te escribe y se hace a un lado."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl bg-kora-bg p-3.5">
              <span className="text-xs font-bold text-kora-primary">{i + 1}</span>
              <p className="mt-0.5 text-sm font-semibold text-kora-text">{t}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-kora-muted">{d}</p>
            </li>
          ))}
        </ol>
      </Tarjeta>
    </div>
  );
}
