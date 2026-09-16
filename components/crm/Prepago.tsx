"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Check, CircleAlert, Gift, Loader2, Lock, ShieldCheck, Wallet, X } from "lucide-react";
import { api } from "./util";
// La ruta de la ficha, escrita una sola vez (lib/crm/types.ts, puro): la usan la
// lista, la ficha, las alertas y esta tabla.
import { rutaFichaHotel } from "@/lib/crm/types";
import { UMBRAL_AVISO_BAJO } from "@/lib/saldo/paquetes";
import {
  ETIQUETA_MAX,
  ETIQUETA_MIN,
  ETIQUETA_SEGURIDAD,
  MENSAJES_SEGURIDAD,
  MENSAJES_TODOS_MAX,
  efectivas,
  estadoSaldoHotel,
  etiquetaValida,
  evaluarCambioFases,
  mensajesMinimos,
  mensajesTodosValidos,
  normalizarEtiqueta,
  pedidoAlTocar,
  type EnsayoRegalo,
  type Interruptores,
  type PanoramaPrepago,
  type Veredicto,
} from "@/lib/saldo/candados";

// El prepago de Camila, con botones. Responde, en este orden:
//   1. ¿En qué fase estamos y qué puedo mover?  → fases e interruptores
//   2. ¿Está hecha la recarga de seguridad?     → antes de callar a nadie
//   3. ¿Cómo va cada hotel?                     → la tabla
//
// Los candados se calculan con `evaluarCambioFases`, la MISMA función que usa
// la API: un interruptor que la API va a rechazar sale apagado y con el motivo
// escrito debajo, en vez de dejar que Manolo lo toque y reciba un «no».
//
// Nada de `window.confirm`: los diálogos son propios porque cada confirmación
// tiene que decir qué va a pasar (a cuántos hoteles, cuántos se callarían) y
// el diálogo del navegador sólo sabe decir «¿Aceptar?».

const tarjeta = "rounded-2xl border border-gray-100 bg-white p-4";
const input =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-kora-text placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent disabled:bg-gray-50 disabled:text-kora-muted";
const botonPrincipal =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-kora-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-kora-primary-dark disabled:cursor-not-allowed disabled:opacity-50";
const botonPeligro =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";
const botonSecundario =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-kora-text transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

const TARDA = "Tarda hasta un minuto en llegar a todos los hoteles.";

const FASES = [
  {
    titulo: "Se mide",
    texto: "Cada respuesta de Camila descuenta un mensaje, pero nadie paga y nadie se calla.",
  },
  {
    titulo: "Se puede recargar",
    texto: "El hotelero compra saldo desde su panel. Camila sigue contestando aunque llegue a cero.",
  },
  {
    titulo: "Sin saldo se calla",
    texto: "Un hotel en cero deja de contestar por WhatsApp hasta que recargue.",
  },
];

function n(v: number): string {
  return v.toLocaleString("es-MX");
}

function fechaHora(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(t);
}

type Aviso = { tipo: "ok" | "error"; texto: string; extra?: string };

/**
 * `vistos` = los interruptores tal como se veían al abrir el diálogo. Viaja con
 * el pedido para que la API rechace encender algo que en otra pestaña cambió y
 * este diálogo no mencionó (`enciendeSinVerlo`).
 */
type CambioFases = { cual: keyof Interruptores; pedido: Interruptores; vistos: Interruptores };

type RegaloAbierto = {
  /** true = la recarga de seguridad: la etiqueta no se puede cambiar. */
  seguridad: boolean;
  etiqueta: string;
  mensajes: string;
  /** El resultado del ensayo. Lo que se confirma es ESTO, no lo que diga el formulario. */
  ensayo: EnsayoRegalo | null;
};

type RespuestaAccion = { ok: boolean; mensaje: string; aviso?: string };

export function Prepago({ inicial }: { inicial: PanoramaPrepago }) {
  const [datos, setDatos] = useState(inicial);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [cambio, setCambio] = useState<CambioFases | null>(null);
  const [regalo, setRegalo] = useState<RegaloAbierto | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null);

  const { fases, seguridad } = datos;
  const e = efectivas(fases);
  const faseActual = e.bloqueo ? 2 : e.recarga ? 1 : 0;

  function veredicto(cual: keyof Interruptores): Veredicto {
    // Sin la tabla de ajustes el guardado va a fallar siempre: mejor decirlo en
    // el interruptor que dejar confirmar para recibir un «no se pudo guardar».
    if (!datos.fasesGuardables) {
      return {
        ok: false,
        motivo: "Todavía no se puede mover desde aquí: falta correr sql/kora-crm-mando.sql en Supabase.",
      };
    }
    return evaluarCambioFases({
      actual: fases,
      pedido: pedidoAlTocar(fases, cual),
      saldoInstalado: datos.saldoInstalado,
      seguridad: { leida: seguridad.leida, faltan: seguridad.faltan.length },
    });
  }

  /** Vuelve a pedir la pantalla. No lanza: si falla, lo dice sin tapar lo que sí se hizo. */
  async function recargar() {
    try {
      const r = await api<{ ok: boolean; prepago: PanoramaPrepago }>("/api/crm/saldo");
      setDatos(r.prepago);
    } catch {
      setAviso((a) => ({
        tipo: a?.tipo ?? "ok",
        texto: a?.texto ?? "",
        extra: [a?.extra, "No pude refrescar los datos: recarga la página para ver cómo quedó."].filter(Boolean).join(" "),
      }));
    }
  }

  function cerrarDialogos() {
    if (ocupado) return;
    setCambio(null);
    setRegalo(null);
    setErrorDialogo(null);
  }

  async function confirmarCambio() {
    if (!cambio) return;
    setOcupado(true);
    setErrorDialogo(null);
    try {
      const r = await api<RespuestaAccion>("/api/crm/saldo", {
        method: "POST",
        body: JSON.stringify({ accion: "fases", ...cambio.pedido, vistos: cambio.vistos }),
      });
      setCambio(null);
      setAviso({ tipo: "ok", texto: r.mensaje, extra: r.aviso });
    } catch (err) {
      setErrorDialogo(err instanceof Error ? err.message : "No se pudo guardar.");
      setOcupado(false);
      return;
    }
    setOcupado(false);
    await recargar();
  }

  function abrirRegalo(esSeguridad: boolean) {
    setErrorDialogo(null);
    setRegalo({
      seguridad: esSeguridad,
      etiqueta: esSeguridad ? ETIQUETA_SEGURIDAD : "",
      mensajes: String(MENSAJES_SEGURIDAD),
      ensayo: null,
    });
  }

  async function ensayar() {
    if (!regalo) return;
    const etiqueta = regalo.seguridad ? ETIQUETA_SEGURIDAD : normalizarEtiqueta(regalo.etiqueta);
    const mensajes = Number(regalo.mensajes);
    if (!etiquetaValida(etiqueta) || !mensajesTodosValidos(mensajes, etiqueta)) return;
    setOcupado(true);
    setErrorDialogo(null);
    try {
      const r = await api<{ ok: boolean; ensayo: EnsayoRegalo }>("/api/crm/saldo", {
        method: "POST",
        body: JSON.stringify({ accion: "regalar_todos", etiqueta, mensajes, ensayo: true }),
      });
      setRegalo((g) => (g ? { ...g, etiqueta, ensayo: r.ensayo } : g));
    } catch (err) {
      setErrorDialogo(err instanceof Error ? err.message : "No se pudo hacer el ensayo.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarRegalo() {
    const ensayo = regalo?.ensayo;
    if (!ensayo) return;
    setOcupado(true);
    setErrorDialogo(null);
    try {
      // Lo que viaja es lo que se ENSEÑÓ en el ensayo, no lo que haya en el
      // formulario: si alguien lo tocara entre el ensayo y el clic, se regalaría
      // otra cosa de la que Manolo leyó.
      const r = await api<RespuestaAccion>("/api/crm/saldo", {
        method: "POST",
        body: JSON.stringify({
          accion: "regalar_todos",
          etiqueta: ensayo.etiqueta,
          mensajes: ensayo.mensajes,
          ensayo: false,
        }),
      });
      setRegalo(null);
      setAviso({ tipo: "ok", texto: r.mensaje, extra: r.aviso });
    } catch (err) {
      // El diálogo se queda abierto: repetir es seguro (mismo `ref`, no suma dos veces).
      setErrorDialogo(err instanceof Error ? err.message : "No se pudo regalar.");
      setOcupado(false);
      return;
    }
    setOcupado(false);
    await recargar();
  }

  const nombresQueFaltan = seguridad.faltan
    .map((id) => datos.hoteles.find((h) => h.id === id)?.nombre)
    .filter((x): x is string => Boolean(x));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ── Lo que no se pudo leer: primero y en rojo ──────────────────── */}
      {datos.fallos.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-red-800">
            <CircleAlert className="h-4 w-4" /> Esta pantalla está incompleta
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {datos.fallos.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        </div>
      )}

      {datos.pendientes.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-kora-text">Falta terminar de instalar</p>
          <ul className="mt-2 space-y-1 text-sm text-kora-muted">
            {datos.pendientes.map((p) => (
              <li key={p}>· {p}</li>
            ))}
          </ul>
        </div>
      )}

      {aviso && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${
            aviso.tipo === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="min-w-0 space-y-1">
            {aviso.texto && <p className="font-medium">{aviso.texto}</p>}
            {aviso.extra && <p className="text-amber-800">{aviso.extra}</p>}
          </div>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="flex-shrink-0 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── En qué fase estamos ───────────────────────────────────────── */}
      <section>
        <h1 className="text-lg font-bold tracking-tight text-kora-text">Prepago de Camila</h1>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {FASES.map((f, i) => (
            <li
              key={f.titulo}
              className={`rounded-2xl border p-4 ${
                i === faseActual ? "border-kora-primary bg-kora-primary/5" : "border-gray-100 bg-white"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-bold text-kora-text">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                    i === faseActual ? "bg-kora-primary text-white" : "bg-gray-100 text-kora-muted"
                  }`}
                >
                  {i + 1}
                </span>
                {f.titulo}
                {i === faseActual && <span className="text-xs font-medium text-kora-primary">· ahora</span>}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-kora-muted">{f.texto}</p>
            </li>
          ))}
        </ol>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">Hoteles en el prepago</div>
            <div className="text-2xl font-bold text-kora-text">{datos.enPrepago === null ? "—" : n(datos.enPrepago)}</div>
            <div className="mt-1 text-xs text-kora-muted">
              {datos.enPrepago === null
                ? "No se pudo leer"
                : // Sin la lista de hoteles, `hoteles.length` es 0 porque no se
                  // pudo leer: «de 0 hoteles» sería un dato inventado.
                  datos.hotelesLeidos
                  ? `de ${n(datos.hoteles.length)} hoteles`
                  : "No se pudo leer la lista de hoteles"}
            </div>
          </div>
          <div className={tarjeta}>
            <div className="text-xs text-kora-muted">En cero hoy</div>
            <div className={`text-2xl font-bold ${datos.mudosHoy ? "text-red-600" : "text-kora-text"}`}>
              {datos.mudosHoy === null ? "—" : n(datos.mudosHoy)}
            </div>
            <div className="mt-1 text-xs text-kora-muted">
              {datos.mudosHoy === null
                ? "No se pudo leer"
                : e.bloqueo
                  ? "Camila no les contesta"
                  : "Se callarían al encender el bloqueo"}
            </div>
          </div>
          <div className={`${tarjeta} col-span-2 lg:col-span-1`}>
            <div className="text-xs text-kora-muted">Recarga de seguridad</div>
            <div
              className={`text-2xl font-bold ${
                seguridad.leida && seguridad.faltan.length > 0 ? "text-amber-600" : "text-kora-text"
              }`}
            >
              {!seguridad.leida ? "—" : seguridad.faltan.length === 0 ? "Hecha" : `Falta en ${n(seguridad.faltan.length)}`}
            </div>
            <div className="mt-1 text-xs text-kora-muted">
              {!seguridad.leida
                ? "No se pudo comprobar"
                : seguridad.total === 0
                  ? "Ningún hotel tiene saldo todavía"
                  : `${n(seguridad.total - seguridad.faltan.length)} de ${n(seguridad.total)} hoteles con saldo la tienen`}
            </div>
          </div>
        </div>
      </section>

      {/* ── Los dos interruptores ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-kora-text">
          <Wallet className="h-4 w-4 text-kora-muted" /> Interruptores
        </h2>
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          <FilaInterruptor
            titulo="Abrir recargas"
            descripcion="Los hoteleros pueden comprar saldo desde la pantalla de Camila en su panel."
            encendido={e.recarga}
            veredicto={veredicto("recarga")}
            onTocar={() => {
              setErrorDialogo(null);
              setCambio({
                cual: "recarga",
                pedido: pedidoAlTocar(fases, "recarga"),
                vistos: { recarga: fases.recarga, bloqueo: fases.bloqueo },
              });
            }}
          />
          <FilaInterruptor
            titulo="Callar a Camila sin saldo"
            descripcion="Un hotel que llegue a cero deja de contestar por WhatsApp hasta que recargue."
            encendido={e.bloqueo}
            peligro
            veredicto={veredicto("bloqueo")}
            onTocar={() => {
              setErrorDialogo(null);
              setCambio({
                cual: "bloqueo",
                pedido: pedidoAlTocar(fases, "bloqueo"),
                vistos: { recarga: fases.recarga, bloqueo: fases.bloqueo },
              });
            }}
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-kora-muted">
          {fases.fuente === "entorno" &&
            "Lo que ves sale de la configuración del servidor: todavía no se ha guardado nada desde aquí, o no se pudo leer lo guardado. En cuanto toques un interruptor, manda lo que elijas aquí. "}
          {TARDA}
          {fases.fuente === "base" && fechaHora(fases.actualizado) && ` · Último cambio: ${fechaHora(fases.actualizado)}`}
        </p>
      </section>

      {/* ── Recarga de seguridad y regalos ────────────────────────────── */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className={tarjeta}>
          <h2 className="flex items-center gap-2 text-sm font-bold text-kora-text">
            <ShieldCheck className="h-4 w-4 text-kora-muted" /> Recarga de seguridad
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-kora-muted">
            Mientras se mide, el saldo baja pero nadie se calla. Si enciendes el bloqueo sin esto, el hotel que ya gastó
            sus mensajes se queda mudo en ese instante, sin aviso y sin haber podido pagar. Le suma mensajes a cada
            hotel una sola vez, aunque la repitas.
          </p>
          {seguridad.leida && seguridad.faltan.length > 0 && nombresQueFaltan.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">Le falta a: {nombresQueFaltan.join(", ")}.</p>
          )}
          {seguridad.leida && seguridad.total > 0 && seguridad.faltan.length === 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Check className="h-3.5 w-3.5" /> Todos los hoteles con saldo ya la tienen.
            </p>
          )}
          <button
            className={`${botonPrincipal} mt-3`}
            onClick={() => abrirRegalo(true)}
            disabled={!datos.saldoInstalado}
          >
            Hacer la recarga de seguridad
          </button>
        </div>

        <div className={tarjeta}>
          <h2 className="flex items-center gap-2 text-sm font-bold text-kora-text">
            <Gift className="h-4 w-4 text-kora-muted" /> Regalar mensajes a todos
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-kora-muted">
            Para una disculpa o un arranque. Cada regalo lleva una etiqueta y se aplica una sola vez por hotel: repetirlo
            no suma dos veces. Antes de regalar ves a quién le toca. Para un solo hotel, entra a su ficha.
          </p>
          <button
            className={`${botonSecundario} mt-3`}
            onClick={() => abrirRegalo(false)}
            disabled={!datos.saldoInstalado}
          >
            Regalar a todos…
          </button>
        </div>
      </section>

      {/* ── El saldo de cada hotel ────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-kora-text">
          Saldo por hotel <span className="font-normal text-kora-muted">({datos.hoteles.length})</span>
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-kora-muted">
                <th className="px-4 py-3 font-medium">Hotel</th>
                <th className="px-4 py-3 text-right font-medium">Mensajes</th>
                <th className="px-4 py-3 text-right font-medium">Gastados (30 d)</th>
                <th className="px-4 py-3 text-right font-medium">Le alcanza</th>
                <th className="px-4 py-3 font-medium">Recarga de seguridad</th>
              </tr>
            </thead>
            <tbody>
              {datos.hoteles.map((h) => {
                const m = h.mensajes;
                // «Fuera del prepago» sólo si el saldo se pudo leer de verdad;
                // si no, esta fila no sabe nada de este hotel.
                const estado = estadoSaldoHotel(m, datos.saldosLeidos);
                const fuera = estado !== "numero";
                return (
                  <tr
                    key={h.id}
                    className={`border-b border-gray-50 last:border-0 ${m !== null && m <= 0 ? "bg-red-50/30" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={rutaFichaHotel(h.slug)}
                        className="font-semibold text-kora-text hover:text-kora-primary hover:underline"
                      >
                        {h.nombre}
                      </Link>
                      <div className="mt-0.5 truncate text-xs text-kora-muted">{h.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m === null ? (
                        estado === "sin-leer" ? (
                          <span className="text-kora-muted" title="No se pudo leer el saldo de este hotel">
                            —
                          </span>
                        ) : (
                          <span
                            title="Nunca se le acreditó nada: Camila no se le calla por saldo"
                            className="inline-block whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                          >
                            fuera del prepago
                          </span>
                        )
                      ) : (
                        <span
                          className={
                            m <= 0
                              ? "font-bold text-red-600"
                              : m <= UMBRAL_AVISO_BAJO
                                ? "font-semibold text-amber-600"
                                : "text-kora-text"
                          }
                        >
                          {n(m)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-kora-muted">
                      {fuera ? "—" : h.consumo30d === null ? <span title="No se pudo contar">—</span> : n(h.consumo30d)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-kora-muted">
                      {fuera || h.consumo30d === null
                        ? "—"
                        : h.dias === null
                          ? "sin consumo"
                          : h.dias === 0
                            ? <span className="font-semibold text-red-600">se acabó</span>
                            : `${n(h.dias)} d`}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {fuera ? (
                        <span className="text-kora-muted">—</span>
                      ) : h.seguridad === null ? (
                        <span className="text-kora-muted" title="No se pudo comprobar">—</span>
                      ) : h.seguridad ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <Check className="h-3.5 w-3.5" /> Hecha
                        </span>
                      ) : (
                        <span className="font-medium text-amber-700">Falta</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {datos.hoteles.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-kora-muted">
                    {/* La tabla vacía por un fallo de lectura no se dice igual que
                        la tabla vacía porque de verdad no hay ningún hotel. */}
                    {datos.hotelesLeidos ? "No hay hoteles todavía." : "No se pudieron leer los hoteles."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-kora-muted">
          «Le alcanza» es al ritmo de los últimos 30 días. «Fuera del prepago» no es saldo cero: a ese hotel nunca se
          le calla por saldo.
        </p>
      </section>

      {/* ── Diálogo: mover un interruptor ─────────────────────────────── */}
      {cambio && (
        <Dialogo
          titulo={textoCambio(cambio).titulo}
          onCerrar={cerrarDialogos}
          bloqueado={ocupado}
        >
          <p className="text-sm leading-relaxed text-kora-text">{textoCambio(cambio).texto}</p>
          {cambio.cual === "bloqueo" && cambio.pedido.bloqueo && datos.mudosHoy !== null && datos.mudosHoy > 0 && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              Ahora mismo {datos.mudosHoy === 1 ? "hay 1 hotel" : `hay ${n(datos.mudosHoy)} hoteles`} en cero:{" "}
              {datos.mudosHoy === 1 ? "se callaría" : "se callarían"} en cuanto lo enciendas.
            </p>
          )}
          <p className="text-xs text-kora-muted">{TARDA}</p>
          {errorDialogo && <ErrorDialogo texto={errorDialogo} />}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className={botonSecundario} onClick={cerrarDialogos} disabled={ocupado}>
              Cancelar
            </button>
            <button
              className={cambio.cual === "bloqueo" && cambio.pedido.bloqueo ? botonPeligro : botonPrincipal}
              onClick={confirmarCambio}
              disabled={ocupado}
            >
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
              {textoCambio(cambio).boton}
            </button>
          </div>
        </Dialogo>
      )}

      {/* ── Diálogo: regalo a todos (ensayo → confirmar) ──────────────── */}
      {regalo && (
        <Dialogo
          titulo={regalo.seguridad ? "Recarga de seguridad" : "Regalar mensajes a todos"}
          onCerrar={cerrarDialogos}
          bloqueado={ocupado}
        >
          {regalo.ensayo === null ? (
            <FormularioRegalo
              regalo={regalo}
              ocupado={ocupado}
              onCambio={(g) => setRegalo(g)}
              onEnsayar={ensayar}
              onCancelar={cerrarDialogos}
              error={errorDialogo}
            />
          ) : (
            <ResultadoEnsayo
              ensayo={regalo.ensayo}
              ocupado={ocupado}
              error={errorDialogo}
              onVolver={() => {
                setErrorDialogo(null);
                setRegalo({ ...regalo, ensayo: null });
              }}
              onConfirmar={confirmarRegalo}
              onCerrar={cerrarDialogos}
            />
          )}
        </Dialogo>
      )}
    </main>
  );
}

function textoCambio(c: CambioFases): { titulo: string; texto: string; boton: string } {
  if (c.cual === "recarga") {
    return c.pedido.recarga
      ? {
          titulo: "Abrir recargas",
          texto:
            "Los hoteleros van a poder comprar saldo desde la pantalla de Camila en su panel, y les llegan los correos de «te queda poco». Camila sigue contestando aunque un hotel llegue a cero.",
          boton: "Abrir recargas",
        }
      : {
          titulo: "Cerrar recargas",
          texto:
            "El panel vuelve a decir «próximamente» y nadie puede pagar. El saldo sigue bajando con cada respuesta de Camila.",
          boton: "Cerrar recargas",
        };
  }
  return c.pedido.bloqueo
    ? {
        titulo: "Callar a Camila sin saldo",
        texto:
          "Un hotel que llegue a cero deja de contestar por WhatsApp hasta que recargue. Al huésped se le avisa que recibieron su mensaje y que una persona del hotel lo va a atender.",
        boton: "Encender el bloqueo",
      }
    : {
        titulo: "Dejar que Camila conteste sin saldo",
        texto: "Camila vuelve a contestar en todos los hoteles, tengan saldo o no. El saldo sigue bajando.",
        boton: "Apagar el bloqueo",
      };
}

function FilaInterruptor({
  titulo,
  descripcion,
  encendido,
  veredicto,
  peligro = false,
  onTocar,
}: {
  titulo: string;
  descripcion: string;
  encendido: boolean;
  veredicto: Veredicto;
  peligro?: boolean;
  onTocar: () => void;
}) {
  const bloqueado = !veredicto.ok;
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold text-kora-text">
          {titulo}{" "}
          <span
            className={`ml-1 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              encendido
                ? peligro
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-100 text-gray-600"
            }`}
          >
            {encendido ? "Encendido" : "Apagado"}
          </span>
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-kora-muted">{descripcion}</p>
        {!veredicto.ok && (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-amber-700">
            <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> {veredicto.motivo}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={encendido}
        aria-label={titulo}
        onClick={onTocar}
        disabled={bloqueado}
        title={bloqueado && !veredicto.ok ? veredicto.motivo : undefined}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kora-accent disabled:cursor-not-allowed disabled:opacity-40 ${
          encendido ? (peligro ? "bg-red-600" : "bg-kora-primary") : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            encendido ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function FormularioRegalo({
  regalo,
  ocupado,
  error,
  onCambio,
  onEnsayar,
  onCancelar,
}: {
  regalo: RegaloAbierto;
  ocupado: boolean;
  error: string | null;
  onCambio: (g: RegaloAbierto) => void;
  onEnsayar: () => void;
  onCancelar: () => void;
}) {
  const etiqueta = regalo.seguridad ? ETIQUETA_SEGURIDAD : normalizarEtiqueta(regalo.etiqueta);
  const etiquetaOk = etiquetaValida(etiqueta);
  const mensajes = Number(regalo.mensajes);
  const minimo = mensajesMinimos(etiqueta);
  const mensajesOk = mensajesTodosValidos(mensajes, etiqueta);

  return (
    <form
      className="space-y-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (etiquetaOk && mensajesOk && !ocupado) onEnsayar();
      }}
    >
      <p className="text-sm leading-relaxed text-kora-muted">
        {regalo.seguridad
          ? "Se le suman mensajes a todos los hoteles, también a los que ya tienen saldo. Primero ves a quién le toca; no se regala nada hasta que confirmes."
          : "Se le suman mensajes a todos los hoteles. A quien ya recibió un regalo con esta misma etiqueta no se le vuelve a sumar. Primero ves a quién le toca."}
      </p>

      <div>
        <label className="mb-1 block text-xs font-medium text-kora-muted" htmlFor="regalo-etiqueta">
          Etiqueta
        </label>
        <input
          id="regalo-etiqueta"
          className={input}
          value={regalo.seguridad ? ETIQUETA_SEGURIDAD : regalo.etiqueta}
          disabled={regalo.seguridad || ocupado}
          maxLength={ETIQUETA_MAX + 10}
          placeholder="disculpa-septiembre"
          onChange={(ev) => onCambio({ ...regalo, etiqueta: ev.target.value })}
          autoFocus={!regalo.seguridad}
        />
        {!regalo.seguridad && regalo.etiqueta.trim() !== "" && (
          <p className={`mt-1 text-xs ${etiquetaOk ? "text-kora-muted" : "text-amber-700"}`}>
            {etiquetaOk
              ? `Se guarda como «${etiqueta}».`
              : `Usa minúsculas, números y guiones, de ${ETIQUETA_MIN} a ${ETIQUETA_MAX} letras. Por ejemplo: disculpa-septiembre.`}
          </p>
        )}
        {regalo.seguridad && (
          <p className="mt-1 text-xs text-kora-muted">
            Es la misma etiqueta que usaba el script de la terminal: si ya se hizo por ahí, aquí cuenta como hecha.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-kora-muted" htmlFor="regalo-mensajes">
          Mensajes por hotel
        </label>
        <input
          id="regalo-mensajes"
          className={input}
          type="number"
          inputMode="numeric"
          min={minimo}
          max={MENSAJES_TODOS_MAX}
          step={1}
          value={regalo.mensajes}
          disabled={ocupado}
          onChange={(ev) => onCambio({ ...regalo, mensajes: ev.target.value })}
        />
        {regalo.mensajes !== "" && !mensajesOk && (
          <p className="mt-1 text-xs text-amber-700">
            Un número entero de {n(minimo)} a {n(MENSAJES_TODOS_MAX)}.
            {regalo.seguridad && " La recarga de seguridad se hace una sola vez por hotel: si sale corta, ya no se puede repetir."}
          </p>
        )}
      </div>

      {error && <ErrorDialogo texto={error} />}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={botonSecundario} onClick={onCancelar} disabled={ocupado}>
          Cancelar
        </button>
        <button type="submit" className={botonPrincipal} disabled={ocupado || !etiquetaOk || !mensajesOk}>
          {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
          Ver a quién le toca
        </button>
      </div>
    </form>
  );
}

function ResultadoEnsayo({
  ensayo,
  ocupado,
  error,
  onVolver,
  onConfirmar,
  onCerrar,
}: {
  ensayo: EnsayoRegalo;
  ocupado: boolean;
  error: string | null;
  onVolver: () => void;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  const nada = ensayo.tocan.length === 0;
  return (
    <div className="space-y-4">
      {nada ? (
        <p className="text-sm leading-relaxed text-kora-text">
          Todos los hoteles ya tienen el regalo «{ensayo.etiqueta}». No hay nada que sumar.
        </p>
      ) : (
        <p className="text-sm leading-relaxed text-kora-text">
          Se le sumarían <strong>{n(ensayo.mensajes)} mensajes</strong> a{" "}
          <strong>
            {ensayo.tocan.length === 1 ? "1 hotel" : `${n(ensayo.tocan.length)} hoteles`}
          </strong>{" "}
          con la etiqueta «{ensayo.etiqueta}». Todavía no se ha regalado nada.
        </p>
      )}

      {!nada && (
        <ul className="max-h-64 divide-y divide-gray-50 overflow-y-auto rounded-xl border border-gray-100">
          {ensayo.tocan.map((h) => (
            <li key={h.slug} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-kora-text">{h.nombre}</span>
              <span className="flex-shrink-0 text-xs tabular-nums text-kora-muted">
                {!ensayo.saldosLeidos
                  ? `+${n(ensayo.mensajes)}`
                  : h.mensajes === null
                    ? `entra al prepago con ${n(ensayo.mensajes)}`
                    : `${n(h.mensajes)} → ${n(h.mensajes + ensayo.mensajes)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!ensayo.saldosLeidos && !nada && (
        <p className="text-xs text-amber-700">No pude leer cuánto tiene cada uno hoy, pero a quién le toca sí es seguro.</p>
      )}

      {ensayo.yaLoTenian.length > 0 && (
        <p className="text-xs leading-relaxed text-kora-muted">
          Ya lo tenían, no se les suma: {ensayo.yaLoTenian.map((h) => h.nombre).join(", ")}.
        </p>
      )}

      {error && <ErrorDialogo texto={error} />}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {nada ? (
          <button className={botonPrincipal} onClick={onCerrar}>
            Cerrar
          </button>
        ) : (
          <>
            <button className={botonSecundario} onClick={onVolver} disabled={ocupado}>
              Cambiar
            </button>
            <button className={botonPrincipal} onClick={onConfirmar} disabled={ocupado}>
              {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar y regalar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ErrorDialogo({ texto }: { texto: string }) {
  return (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {texto}
    </p>
  );
}

function Dialogo({
  titulo,
  onCerrar,
  bloqueado,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  /** Mientras hay una petición en curso no se cierra: el resultado tiene que verse. */
  bloqueado: boolean;
  children: React.ReactNode;
}) {
  const idTitulo = useId();

  useEffect(() => {
    function alTeclear(ev: KeyboardEvent) {
      if (ev.key === "Escape" && !bloqueado) onCerrar();
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar, bloqueado]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={() => {
        if (!bloqueado) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-lg sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h2 id={idTitulo} className="font-bold text-kora-text">
            {titulo}
          </h2>
          <button
            onClick={onCerrar}
            disabled={bloqueado}
            aria-label="Cerrar"
            className="text-gray-400 hover:text-kora-text disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">{children}</div>
      </div>
    </div>
  );
}
