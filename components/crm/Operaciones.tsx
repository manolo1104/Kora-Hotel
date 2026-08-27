"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CircleAlert,
  ExternalLink,
  Mail,
  Search,
} from "lucide-react";
import { money } from "./util";
import type { HotelOps, Operaciones as Datos, SituacionHotel } from "@/lib/crm/operaciones";
import { VENTANA_DIAS } from "@/lib/crm/types";

// El puesto de mando del fundador. Responde tres preguntas, en este orden:
//   1. ¿Cómo va el negocio?            → la fila de métricas
//   2. ¿Qué requiere mi atención HOY?  → las alertas
//   3. ¿Qué pasa con cada hotel?       → la tabla
//
// Las alertas van ARRIBA de la tabla a propósito: una tabla de 30 hoteles no
// dice cuál se está por caer, y ese es el dato que hace ganar o perder dinero.

const SITUACION: Record<SituacionHotel, { label: string; clase: string }> = {
  pago: { label: "Pagando", clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cortesia: { label: "Cortesía", clase: "bg-sky-50 text-sky-700 border-sky-200" },
  prueba: { label: "En prueba", clase: "bg-amber-50 text-amber-700 border-amber-200" },
  prueba_vencida: { label: "Prueba vencida", clase: "bg-gray-100 text-gray-600 border-gray-200" },
  moroso: { label: "Cobro fallido", clase: "bg-red-50 text-red-700 border-red-200" },
  cancelada: { label: "Cancelada", clase: "bg-gray-100 text-gray-600 border-gray-200" },
  bloqueado: { label: "Bloqueado", clase: "bg-red-100 text-red-800 border-red-300" },
  demo: { label: "Demo", clase: "bg-violet-50 text-violet-700 border-violet-200" },
};

type Filtro = "todos" | "pagando" | "prueba" | "riesgo" | "sin_estrenar";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "pagando", label: "Pagando" },
  { id: "prueba", label: "En prueba" },
  { id: "riesgo", label: "En riesgo" },
  { id: "sin_estrenar", label: "Sin estrenar" },
];

/** "En riesgo" es lo que se puede perder esta semana si nadie hace nada. */
function enRiesgo(h: HotelOps): boolean {
  if (h.situacion === "moroso" || h.cancelaAlFinal) return true;
  if (h.situacion === "prueba" && (h.diasPrueba ?? 99) <= 7) return true;
  if (h.situacion === "pago" && h.reservas.total === 0 && h.diasDeVida >= 7) return true;
  return false;
}

function sinEstrenar(h: HotelOps): boolean {
  return h.reservas.total === 0 && h.situacion !== "demo";
}

function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} d`;
  const m = Math.floor(d / 30);
  return `hace ${m} mes${m === 1 ? "" : "es"}`;
}

const tarjeta = "rounded-2xl border border-gray-100 bg-white p-4";

export function Operaciones({ datos }: { datos: Datos }) {
  const { metricas: m, alertas, hoteles, origenesSuscriptores, fallos, pendientes } = datos;
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return hoteles
      .filter((h) => {
        if (filtro === "pagando" && h.situacion !== "pago") return false;
        if (filtro === "prueba" && h.situacion !== "prueba") return false;
        if (filtro === "riesgo" && !enRiesgo(h)) return false;
        if (filtro === "sin_estrenar" && !sinEstrenar(h)) return false;
        if (!needle) return true;
        return (
          h.nombre.toLowerCase().includes(needle) ||
          h.slug.toLowerCase().includes(needle) ||
          (h.ownerEmail ?? "").toLowerCase().includes(needle)
        );
      })
      // Lo que puede doler primero; dentro de eso, quien más mueve.
      .sort((a, b) => {
        const ra = enRiesgo(a) ? 0 : 1;
        const rb = enRiesgo(b) ? 0 : 1;
        if (ra !== rb) return ra - rb;
        return b.reservas.recientes - a.reservas.recientes;
      });
  }, [hoteles, filtro, q]);

  const conteo = (f: Filtro): number => {
    if (f === "todos") return hoteles.length;
    if (f === "pagando") return m.pago;
    if (f === "prueba") return m.prueba;
    if (f === "riesgo") return hoteles.filter(enRiesgo).length;
    return hoteles.filter(sinEstrenar).length;
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Datos que no se pudieron leer ─────────────────────────────────
          Va lo PRIMERO y en rojo: si algo falló, todos los números de abajo
          están mal y hay que saberlo antes de leerlos, no después. */}
      {fallos.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-800">
            <CircleAlert className="h-4 w-4" /> Esta pantalla está incompleta
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {fallos.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── SQL sin correr ────────────────────────────────────────────────
          En gris, no en rojo: no es una avería, es un paso de instalación. Si
          esto pintara la banda roja, estaría encendida siempre y la banda roja
          dejaría de significar algo. */}
      {pendientes.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-kora-text">Falta terminar de instalar</p>
          <ul className="mt-2 space-y-1 text-sm text-kora-muted">
            {pendientes.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Cómo va el negocio ────────────────────────────────────────── */}
      <section>
        <h1 className="text-lg font-bold tracking-tight text-kora-text">Operaciones</h1>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">MRR</div>
            <div className="text-2xl font-bold text-kora-text">{money(m.mrr)}</div>
            <div className="mt-1 text-xs text-kora-muted">
              {m.pago} pagando
              {m.cortesia > 0 && ` · ${m.cortesia} de cortesía (no suma)`}
            </div>
          </div>
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">Hoteles</div>
            <div className="text-2xl font-bold text-kora-text">{m.hoteles}</div>
            <div className="mt-1 text-xs text-kora-muted">
              {m.prueba} en prueba · {m.pruebaVencida} vencidas
            </div>
          </div>
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">Reservas ({VENTANA_DIAS} días)</div>
            <div className="text-2xl font-bold text-kora-text">{m.reservasRecientes}</div>
            <div className="mt-1 text-xs text-kora-muted">
              {money(m.gmvReciente)} movidos · {m.reservasTotal} históricas
            </div>
          </div>
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">Lista de correo</div>
            <div className="text-2xl font-bold text-kora-text">{m.suscriptoresActivos}</div>
            <div className="mt-1 text-xs text-kora-muted">
              +{m.suscriptoresNuevos7d} en 7 días
              {m.bajas > 0 && ` · ${m.bajas} baja${m.bajas === 1 ? "" : "s"}`}
            </div>
          </div>
        </div>
      </section>

      {/* ── Lo que requiere atención ──────────────────────────────────── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-kora-text">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Requiere tu atención
          {alertas.length > 0 && (
            <span className="rounded-full bg-kora-text px-2 py-0.5 text-[11px] font-semibold text-white">
              {alertas.length}
            </span>
          )}
        </h2>

        {alertas.length === 0 ? (
          <div className={`${tarjeta} text-sm text-kora-muted`}>
            Nada urgente hoy. Ningún cobro fallido, ninguna prueba por vencer y
            ningún hotel de pago sin estrenar.
          </div>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a) => (
              <li
                key={a.id}
                className={`rounded-2xl border p-4 ${
                  a.severidad === "alta"
                    ? "border-red-200 bg-red-50/60"
                    : "border-amber-200 bg-amber-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-kora-text">{a.titulo}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-kora-muted">{a.detalle}</p>
                  </div>
                  {a.href && (
                    <Link
                      href={a.href}
                      className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-kora-primary hover:underline"
                    >
                      Ver <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Los hoteles ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-kora-text">
            Hoteles <span className="font-normal text-kora-muted">({visibles.length})</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filtro === f.id
                    ? "border-kora-primary bg-kora-primary text-white"
                    : "border-gray-200 bg-white text-kora-muted hover:text-kora-text"
                }`}
              >
                {f.label} <span className="opacity-60">{conteo(f.id)}</span>
              </button>
            ))}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kora-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar hotel o correo"
                className="w-52 rounded-full border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-kora-text placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-kora-muted">
                <th className="px-4 py-3 font-medium">Hotel</th>
                <th className="px-4 py-3 font-medium">Situación</th>
                <th className="px-4 py-3 text-right font-medium">Reservas {VENTANA_DIAS}d</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Movido ({VENTANA_DIAS}d)</th>
                <th className="px-4 py-3 font-medium">Última reserva</th>
                <th className="px-4 py-3 font-medium">Alta</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((h) => {
                const s = SITUACION[h.situacion];
                const riesgo = enRiesgo(h);
                return (
                  <tr
                    key={h.id}
                    className={`border-b border-gray-50 last:border-0 ${riesgo ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-semibold text-kora-text">
                        {h.nombre}
                        {!h.publicado && h.situacion !== "demo" && (
                          <span
                            title="Sin publicar: no puede cobrar"
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
                          >
                            sin publicar
                          </span>
                        )}
                        {h.situacion === "bloqueado" && (
                          <Ban className="h-3.5 w-3.5 text-red-600" aria-label="Bloqueado" />
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-kora-muted">
                        {h.ownerEmail ?? "sin correo"}
                        {!h.cobraConStripe && h.situacion !== "demo" && (
                          <span className="ml-1.5 text-amber-600">· sin Stripe</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.clase}`}
                      >
                        {s.label}
                        {h.diasPrueba !== null && ` · ${h.diasPrueba} d`}
                      </span>
                      {h.cancelaAlFinal && (
                        <div className="mt-1 text-[11px] font-medium text-red-600">
                          cancela al final
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-kora-text">
                      {h.reservas.recientes}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        h.reservas.total === 0 ? "font-semibold text-red-600" : "text-kora-muted"
                      }`}
                    >
                      {h.reservas.total}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-kora-muted">
                      {h.reservas.gmvReciente > 0 ? money(h.reservas.gmvReciente) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-kora-muted">
                      {haceCuanto(h.reservas.ultima)}
                    </td>
                    <td className="px-4 py-3 text-xs text-kora-muted">{h.diasDeVida} d</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/h/${h.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir el sitio del hotel"
                        className="inline-flex text-kora-muted hover:text-kora-primary"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-kora-muted">
                    Ningún hotel con ese filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-kora-muted">
          Las reservas canceladas y las reembolsadas cuentan como uso del producto,
          pero no suman al dinero movido.
        </p>
      </section>

      {/* ── De dónde salen los suscriptores ───────────────────────────── */}
      {origenesSuscriptores.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-kora-text">
            <Mail className="h-4 w-4 text-kora-muted" />
            Qué superficie capta correos
          </h2>
          <div className={tarjeta}>
            <ul className="space-y-2">
              {origenesSuscriptores.map((o) => {
                const pct = m.suscriptoresActivos
                  ? Math.round((o.n / m.suscriptoresActivos) * 100)
                  : 0;
                return (
                  <li key={o.origen} className="flex items-center gap-3">
                    <span className="w-28 flex-shrink-0 truncate text-xs text-kora-muted">
                      {o.origen}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <span
                        className="block h-full rounded-full bg-kora-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="w-16 flex-shrink-0 text-right text-xs tabular-nums text-kora-text">
                      {o.n} <span className="text-kora-muted">({pct}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-kora-muted">
              Los artículos y las herramientas se agrupan por familia. Si una
              superficie no aparece, todavía no ha captado a nadie.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
