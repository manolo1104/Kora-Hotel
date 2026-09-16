"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, CircleAlert, Search } from "lucide-react";
// Sólo el tipo: lib/crm/ficha.ts usa la service-role.
import type { FilaHotelLista, ListaHoteles } from "@/lib/crm/ficha";
import { Chip, chipCamila, chipSituacion, haceCuanto } from "./FichaHotel";
import { rutaFichaHotel } from "@/lib/crm/types";

// La lista de hoteles del CRM. Cada fila abre la ficha del hotel
// (/crm/hoteles/[slug]), que es donde están los botones.
//
// Antes esta pantalla era sólo «bloquear / desbloquear» y no decía ni quién era
// el dueño ni si pagaba. El bloqueo sigue existiendo, dentro de la ficha, con
// motivo y bitácora.
//
// Cada columna que viene de una fuente que no se pudo leer (Stripe, el servidor
// de Camila, el saldo) se pinta como «?» y se explica arriba: una columna entera
// de «No» por un fallo de lectura es la forma más fácil de tomar una mala
// decisión.

type Filtro = "todos" | "prueba" | "sin_cobros" | "bloqueados";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "prueba", label: "En prueba" },
  { id: "sin_cobros", label: "Sin cobros listos" },
  { id: "bloqueados", label: "Bloqueados" },
];

function pasaFiltro(h: FilaHotelLista, f: Filtro): boolean {
  if (f === "prueba") return h.situacion === "prueba";
  if (f === "sin_cobros") return !h.cobrosListos && h.situacion !== "demo";
  if (f === "bloqueados") return h.situacion === "bloqueado";
  return true;
}

const DESCONOCIDO = <span className="text-kora-muted" title="No se pudo leer">?</span>;

function Cobros({ h, leido }: { h: FilaHotelLista; leido: boolean }) {
  if (!leido) return DESCONOCIDO;
  return h.cobrosListos ? (
    <span className="text-emerald-700">Sí</span>
  ) : (
    <span className="text-amber-700">No</span>
  );
}

function Saldo({ h, leido }: { h: FilaHotelLista; leido: boolean }) {
  if (!leido) return DESCONOCIDO;
  if (!h.saldo) return <span className="text-kora-muted">fuera</span>;
  return (
    <span className={h.saldo.mensajes <= 0 ? "font-semibold text-red-600" : "text-kora-text"}>
      {h.saldo.mensajes.toLocaleString("es-MX")}
    </span>
  );
}

export function HotelesAdmin({ datos }: { datos: ListaHoteles }) {
  const router = useRouter();
  const { hoteles, lecturas, fallos, pendientes } = datos;
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");

  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return hoteles.filter((h) => {
      if (!pasaFiltro(h, filtro)) return false;
      if (!needle) return true;
      return (
        h.nombre.toLowerCase().includes(needle) ||
        h.slug.toLowerCase().includes(needle) ||
        (h.ownerEmail ?? "").toLowerCase().includes(needle)
      );
    });
  }, [hoteles, filtro, q]);

  const filtros = FILTROS.filter((f) => f.id !== "sin_cobros" || lecturas.cobros);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Lo que no se pudo leer va PRIMERO: si algo falló, la tabla de abajo
          está incompleta y hay que saberlo antes de leerla. */}
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

      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-kora-text">
              Hoteles <span className="font-normal text-kora-muted">({visibles.length})</span>
            </h1>
            <p className="text-xs text-kora-muted">
              Abre un hotel para darle cortesía, más días de prueba o mensajes, marcarlo como demo o bloquearlo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filtros.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                aria-pressed={filtro === f.id}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  filtro === f.id
                    ? "border-kora-primary bg-kora-primary text-white"
                    : "border-gray-200 bg-white text-kora-muted hover:text-kora-text"
                }`}
              >
                {f.label}{" "}
                <span className="opacity-60">{hoteles.filter((h) => pasaFiltro(h, f.id)).length}</span>
              </button>
            ))}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-kora-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar hotel o correo"
                aria-label="Buscar hotel o correo"
                className="w-52 rounded-full border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-kora-text placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent"
              />
            </div>
          </div>
        </div>

        {!lecturas.hoteles ? (
          <div className="rounded-2xl border border-red-200 bg-white p-6 text-center text-sm text-red-700">
            No se pudieron leer los hoteles. Recarga en un momento.
          </div>
        ) : (
          <>
            {/* ── Móvil: tarjetas ─────────────────────────────────────── */}
            <ul className="space-y-2 sm:hidden">
              {visibles.map((h) => (
                <li key={h.id}>
                  <Link href={rutaFichaHotel(h.slug)} className="block rounded-2xl border border-gray-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-kora-text">{h.nombre}</p>
                        <p className="truncate text-xs text-kora-muted">
                          {h.ownerEmail ?? (lecturas.correos ? "sin correo" : "correo sin leer")}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-kora-muted" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-kora-muted">
                      <Chip
                        estilo={chipSituacion(h.situacion)}
                        extra={h.diasPrueba !== null ? ` · ${h.diasPrueba} d` : undefined}
                      />
                      {lecturas.camila && <Chip estilo={chipCamila(h.camila)} />}
                      <span>
                        Cobros: <Cobros h={h} leido={lecturas.cobros} />
                      </span>
                      <span>
                        · Saldo: <Saldo h={h} leido={lecturas.saldo} />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {/* ── Escritorio: tabla ───────────────────────────────────── */}
            <div className="hidden overflow-x-auto rounded-2xl border border-gray-100 bg-white sm:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-kora-muted">
                    <th className="px-4 py-3 font-medium">Hotel</th>
                    <th className="px-4 py-3 font-medium">Dueño</th>
                    <th className="px-4 py-3 font-medium">Situación</th>
                    <th className="px-4 py-3 font-medium">Cobros listos</th>
                    <th className="px-4 py-3 font-medium">Camila</th>
                    <th className="px-4 py-3 text-right font-medium">Saldo</th>
                    <th className="px-4 py-3 font-medium">Alta</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => router.push(rutaFichaHotel(h.slug))}
                      className={`cursor-pointer border-b border-gray-50 last:border-0 hover:bg-kora-bg ${
                        h.situacion === "bloqueado" ? "bg-red-50/30" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {/* El enlace es lo que se puede abrir con el teclado o en otra pestaña;
                            el clic en el resto de la fila es un atajo. */}
                        <Link
                          href={rutaFichaHotel(h.slug)}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-kora-text hover:text-kora-primary"
                        >
                          {h.nombre}
                        </Link>
                        <div className="mt-0.5 text-xs text-kora-muted">
                          /h/{h.slug}
                          {!h.publicado && h.situacion !== "demo" && (
                            <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                              sin publicar
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-xs text-kora-muted">
                        {h.ownerEmail ?? (lecturas.correos ? "sin correo" : DESCONOCIDO)}
                      </td>
                      <td className="px-4 py-3">
                        <Chip
                          estilo={chipSituacion(h.situacion)}
                          extra={h.diasPrueba !== null ? ` · ${h.diasPrueba} d` : undefined}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <Cobros h={h} leido={lecturas.cobros} />
                      </td>
                      <td className="px-4 py-3">{lecturas.camila ? <Chip estilo={chipCamila(h.camila)} /> : DESCONOCIDO}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-xs">
                        <Saldo h={h} leido={lecturas.saldo} />
                      </td>
                      <td className="px-4 py-3 text-xs text-kora-muted">{haceCuanto(h.createdAt)}</td>
                      <td className="px-4 py-3 text-right text-kora-muted">
                        <ChevronRight className="inline h-4 w-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {visibles.length === 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-kora-muted">
                {hoteles.length === 0 ? "Todavía no se ha dado de alta ningún hotel." : "Ningún hotel con ese filtro."}
              </div>
            )}

            <p className="text-xs text-kora-muted">
              «Cobros listos» es si su propia cuenta de Stripe ya puede cobrar (dato guardado; la ficha lo comprueba al
              abrirla). Saldo «fuera» = nunca se le acreditaron mensajes: Camila no se le calla por saldo.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
