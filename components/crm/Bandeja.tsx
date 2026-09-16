"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  CircleAlert,
  Hotel,
  Loader2,
  Mail,
  MessageCircle,
  MessagesSquare,
  RotateCcw,
  UserPlus,
} from "lucide-react";
// SÓLO tipos: lib/crm/bandeja.ts usa la service-role y no puede llegar al navegador.
import type { AlertaBandeja, ChatBandeja, DatosBandeja, DatosChats, EstadoChat } from "@/lib/crm/bandeja";
// lib/crm/types es de cliente y servidor (sin base): la misma ruta que usan las alertas de Operaciones.
import { rutaFichaHotel } from "@/lib/crm/types";
import { api, waLink } from "./util";

// La bandeja del fundador: alertas del camino del dinero y chats de la web que
// pidieron una persona. Después de cada botón se vuelve a pedir la lista al
// servidor en vez de retocarla aquí: las alertas se agrupan en el servidor, y
// adivinar el grupo en el navegador acababa enseñando algo distinto de lo que
// hay en la base.

type Pestana = "alertas" | "chats";

type Aviso = { tipo: "ok" | "error"; texto: string; leadId?: string } | null;

const tarjeta = "rounded-2xl border bg-white p-4";
const botonPrincipal =
  "inline-flex items-center gap-1.5 rounded-xl bg-kora-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-kora-primary-dark disabled:opacity-50 transition-colors";
const botonSecundario =
  "inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-kora-text hover:bg-gray-50 disabled:opacity-50 transition-colors";
const campo =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-kora-text focus:outline-none focus:ring-2 focus:ring-kora-accent";

// ─── Fechas ──────────────────────────────────────────────────────────────────
//
// Se arman a mano con las partes NUMÉRICAS de Intl y no con su texto: el nombre
// del mes lo escriben distinto el servidor y el navegador («sep» / «sept»), y
// esa diferencia sale como error de hidratación. Los números no cambian.

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const PARTES_MX = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

function fechaHora(iso: string | null | undefined): string {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(ms)) return "—";
  const p = Object.fromEntries(PARTES_MX.formatToParts(ms).map((x) => [x.type, x.value]));
  const mes = MESES[Number(p.month) - 1] ?? "";
  return `${Number(p.day)} ${mes} ${p.year}, ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

// Después de guardar se vuelve a pedir la lista. Si ESO falla, lo guardado sí
// quedó: antes el error de la recarga caía en el mismo `catch` que el del botón
// y la pantalla decía en rojo «no se pudo» sobre algo que ya estaba hecho (y el
// fundador lo repetía).
const SIN_REFRESCAR = "Se guardó, pero la lista no se pudo actualizar. Recarga la página para verla al día.";

function juntar(...partes: (string | null | undefined)[]): string {
  return partes.filter(Boolean).join(" ");
}

/** «hace 3 h», contado desde la hora del SERVIDOR al cargar (no el reloj de esta computadora). */
function hace(iso: string | null | undefined, ahora: string): string {
  const t = iso ? Date.parse(iso) : Number.NaN;
  const n = Date.parse(ahora);
  if (!Number.isFinite(t) || !Number.isFinite(n)) return "";
  const min = Math.floor((n - t) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

export function Bandeja({ datos, pestanaInicial }: { datos: DatosBandeja; pestanaInicial: Pestana }) {
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const [ahora, setAhora] = useState(datos.generado);
  const [alertas, setAlertas] = useState<AlertaBandeja[]>(
    datos.alertas.estado === "ok" ? datos.alertas.data.alertas : [],
  );
  const [chatsInfo, setChatsInfo] = useState<Omit<DatosChats, "chats">>(
    datos.chats.estado === "ok"
      ? { puedeAtender: datos.chats.data.puedeAtender, leadsLeidos: datos.chats.data.leadsLeidos }
      : { puedeAtender: false, leadsLeidos: false },
  );
  const [chats, setChats] = useState<ChatBandeja[]>(datos.chats.estado === "ok" ? datos.chats.data.chats : []);
  const [aviso, setAviso] = useState<Aviso>(null);

  const alertasPendientes = alertas.filter((a) => !a.atendida_at).length;
  const chatsPendientes = chats.filter((c) => c.estado !== "atendido").length;

  function cambiarPestana(p: Pestana) {
    setPestana(p);
    setAviso(null);
    // Para que recargar o compartir el enlace abra la misma pestaña. Explícito
    // también para «alertas»: sin parámetro la página abre la que tenga pendientes.
    try {
      window.history.replaceState(null, "", `?pestana=${p}`);
    } catch {
      /* sin historial (vista previa): da igual */
    }
  }

  /** true = la lista quedó al día. NUNCA lanza (ver SIN_REFRESCAR). */
  async function recargarAlertas(): Promise<boolean> {
    try {
      const r = await api<{ alertas?: AlertaBandeja[] }>("/api/crm/alertas");
      setAlertas(r.alertas ?? []);
      setAhora(new Date().toISOString());
      return true;
    } catch {
      return false;
    }
  }

  /** true = la lista quedó al día. NUNCA lanza (ver SIN_REFRESCAR). */
  async function recargarChats(): Promise<boolean> {
    try {
      const r = await api<{ chats?: ChatBandeja[]; puedeAtender?: boolean; leadsLeidos?: boolean }>(
        "/api/crm/soporte",
      );
      setChats(r.chats ?? []);
      setChatsInfo({ puedeAtender: r.puedeAtender ?? false, leadsLeidos: r.leadsLeidos ?? false });
      setAhora(new Date().toISOString());
      return true;
    } catch {
      return false;
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-kora-text">Bandeja</h1>
        <p className="mt-1 text-sm text-kora-muted">
          Lo que pide que hagas algo: fallos del cobro y las reservas, y visitantes de la web que pidieron hablar con
          una persona.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bandeja">
        <PestanaBoton
          activa={pestana === "alertas"}
          onClick={() => cambiarPestana("alertas")}
          icono={<Bell className="h-3.5 w-3.5" />}
          texto="Alertas"
          pendientes={alertasPendientes}
        />
        <PestanaBoton
          activa={pestana === "chats"}
          onClick={() => cambiarPestana("chats")}
          icono={<MessagesSquare className="h-3.5 w-3.5" />}
          texto="Chats de la web"
          pendientes={chatsPendientes}
        />
      </div>

      {aviso && (
        <div
          role={aviso.tipo === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            aviso.tipo === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {aviso.texto}
          {aviso.leadId && (
            <>
              {" "}
              <Link href={`/crm/${aviso.leadId}`} className="font-semibold underline">
                Ver el lead
              </Link>
            </>
          )}
        </div>
      )}

      {pestana === "alertas" ? (
        <PanelAlertas
          lectura={datos.alertas}
          alertas={alertas}
          ahora={ahora}
          recargar={recargarAlertas}
          setAviso={setAviso}
        />
      ) : (
        <PanelChats
          lectura={datos.chats}
          chats={chats}
          info={chatsInfo}
          ahora={ahora}
          recargar={recargarChats}
          setAviso={setAviso}
        />
      )}
    </main>
  );
}

function PestanaBoton({
  activa,
  onClick,
  icono,
  texto,
  pendientes,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  texto: string;
  pendientes: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
        activa
          ? "border-kora-primary bg-kora-primary text-white"
          : "border-gray-200 bg-white text-kora-muted hover:text-kora-text"
      }`}
    >
      {icono}
      {texto}
      {pendientes > 0 && (
        <span
          className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${
            activa ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
          }`}
        >
          {pendientes}
        </span>
      )}
    </button>
  );
}

/** Nota gris (instalación pendiente) o banda roja (fallo) de una lectura que no salió. */
function EstadoLectura({ lectura, que }: { lectura: DatosBandeja["alertas"] | DatosBandeja["chats"]; que: string }) {
  if (lectura.estado === "falta-sql") {
    // Gris, no rojo: no es una avería, es un paso de instalación.
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-kora-text">Falta terminar de instalar</p>
        <p className="mt-1 text-sm text-kora-muted">
          Corre <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{lectura.archivo}</code> en Supabase para
          ver aquí {que}.
          {que === "las alertas" && " Mientras tanto siguen llegando por correo."}
        </p>
      </div>
    );
  }
  if (lectura.estado === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-red-800">
          <CircleAlert className="h-4 w-4" /> No se pudieron leer {que}
        </p>
        <p className="mt-1 text-sm text-red-700">
          {lectura.detalle} Que no se vea nada aquí NO quiere decir que no haya nada.
        </p>
      </div>
    );
  }
  return lectura.aviso ? (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-kora-muted">{lectura.aviso}</div>
  ) : null;
}

// ─── Alertas ─────────────────────────────────────────────────────────────────

function PanelAlertas({
  lectura,
  alertas,
  ahora,
  recargar,
  setAviso,
}: {
  lectura: DatosBandeja["alertas"];
  alertas: AlertaBandeja[];
  ahora: string;
  recargar: () => Promise<boolean>;
  setAviso: (a: Aviso) => void;
}) {
  const [ocupada, setOcupada] = useState<string | null>(null);

  if (lectura.estado !== "ok") return <EstadoLectura lectura={lectura} que="las alertas" />;

  const pendientes = alertas.filter((a) => !a.atendida_at);
  const atendidas = alertas.filter((a) => a.atendida_at);

  async function accion(a: AlertaBandeja) {
    setOcupada(a.clave);
    setAviso(null);
    try {
      const cuerpo = a.atendida_at
        ? { accion: "reabrir", asunto: a.asunto, atendida_at: a.atendida_at }
        : { accion: "atender", asunto: a.asunto, hasta: a.ultima };
      const r = await api<{ aviso?: string; mensaje?: string }>("/api/crm/alertas", {
        method: "POST",
        body: JSON.stringify(cuerpo),
      });
      const alDia = await recargar();
      if (r.aviso || !alDia) setAviso({ tipo: "error", texto: juntar(r.aviso, alDia ? null : SIN_REFRESCAR) });
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo guardar. Intenta de nuevo." });
    } finally {
      setOcupada(null);
    }
  }

  return (
    <section className="space-y-4">
      <EstadoLectura lectura={lectura} que="las alertas" />

      {pendientes.length === 0 ? (
        <div className={`${tarjeta} border-gray-100 flex items-center gap-2 text-sm text-kora-muted`}>
          <Check className="h-4 w-4 text-kora-accent" /> Nada por atender.
        </div>
      ) : (
        <ul className="space-y-3">
          {pendientes.map((a) => (
            <TarjetaAlerta key={a.clave} a={a} ahora={ahora} ocupada={ocupada === a.clave} onAccion={() => accion(a)} />
          ))}
        </ul>
      )}

      {atendidas.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-kora-text">Atendidas hace poco</h2>
          <ul className="space-y-3">
            {atendidas.map((a) => (
              <TarjetaAlerta
                key={`${a.clave}-${a.atendida_at}`}
                a={a}
                ahora={ahora}
                ocupada={ocupada === a.clave}
                onAccion={() => accion(a)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TarjetaAlerta({
  a,
  ahora,
  ocupada,
  onAccion,
}: {
  a: AlertaBandeja;
  ahora: string;
  ocupada: boolean;
  onAccion: () => void;
}) {
  const pendiente = !a.atendida_at;
  return (
    <li className={`${tarjeta} ${pendiente ? "border-amber-200" : "border-gray-100 opacity-75"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-kora-text break-words">{a.asunto}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-kora-muted">
            <span title={fechaHora(a.ultima)}>{hace(a.ultima, ahora)}</span>
            {a.veces > 1 && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                {plural(a.veces, "vez", "veces")} desde {fechaHora(a.primera)}
              </span>
            )}
            {!pendiente && <span>· atendida el {fechaHora(a.atendida_at)}</span>}
          </p>
          {a.hoteles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {a.hoteles.map((h) => (
                <Link
                  key={h.slug}
                  href={rutaFichaHotel(h.slug)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-kora-text hover:border-kora-primary hover:text-kora-primary"
                >
                  <Hotel className="h-3 w-3" /> {h.nombre}
                </Link>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onAccion}
          disabled={ocupada}
          className={pendiente ? botonPrincipal : botonSecundario}
        >
          {ocupada ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : pendiente ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {pendiente ? (a.veces > 1 ? "Marcar todas atendidas" : "Marcar atendida") : "Reabrir"}
        </button>
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-xs font-semibold text-kora-primary select-none">
          Ver detalle{a.veces > 1 ? ` (${a.ocurrencias.length < a.veces ? `las ${a.ocurrencias.length} más recientes` : "todas"})` : ""}
        </summary>
        <ul className="mt-2 space-y-2">
          {a.ocurrencias.map((o) => (
            <li key={o.id} className="rounded-lg bg-kora-bg p-3">
              {a.veces > 1 && <p className="mb-1 text-[11px] text-kora-muted">{fechaHora(o.created_at)}</p>}
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-kora-text">
                {o.detalle || "(sin detalle)"}
              </pre>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

// ─── Chats ───────────────────────────────────────────────────────────────────

const ESTADO_CHAT: Record<EstadoChat, { texto: string; clase: string }> = {
  pendiente: { texto: "Sin atender", clase: "border-amber-200 bg-amber-50 text-amber-800" },
  volvio: { texto: "Volvió a escribir", clase: "border-red-200 bg-red-50 text-red-700" },
  atendido: { texto: "Atendido", clase: "border-gray-200 bg-gray-50 text-kora-muted" },
};

function PanelChats({
  lectura,
  chats,
  info,
  ahora,
  recargar,
  setAviso,
}: {
  lectura: DatosBandeja["chats"];
  chats: ChatBandeja[];
  info: Omit<DatosChats, "chats">;
  ahora: string;
  recargar: () => Promise<boolean>;
  setAviso: (a: Aviso) => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<string | null>(null);

  if (lectura.estado !== "ok") return <EstadoLectura lectura={lectura} que="los chats" />;

  async function atender(c: ChatBandeja) {
    setOcupado(c.id);
    setAviso(null);
    try {
      const r = await api<{ aviso?: string }>("/api/crm/soporte", {
        method: "POST",
        body: JSON.stringify({ accion: "atender", id: c.id, atendido: c.estado !== "atendido" }),
      });
      const alDia = await recargar();
      if (r.aviso || !alDia) setAviso({ tipo: "error", texto: juntar(r.aviso, alDia ? null : SIN_REFRESCAR) });
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo guardar. Intenta de nuevo." });
    } finally {
      setOcupado(null);
    }
  }

  async function crearLead(c: ChatBandeja, datos: DatosFormularioLead): Promise<boolean> {
    setOcupado(c.id);
    setAviso(null);
    try {
      const r = await api<{ leadId: string; yaExistia?: boolean; aviso?: string }>("/api/crm/soporte", {
        method: "POST",
        body: JSON.stringify({ accion: "a_lead", id: c.id, ...datos }),
      });
      setFormulario(null);
      const alDia = await recargar();
      setAviso({
        tipo: r.aviso || !alDia ? "error" : "ok",
        texto: juntar(r.yaExistia ? "Este chat ya era un lead." : r.aviso ?? "Lead creado.", alDia ? null : SIN_REFRESCAR),
        leadId: r.leadId,
      });
      return true;
    } catch (e) {
      setAviso({ tipo: "error", texto: e instanceof Error ? e.message : "No se pudo crear el lead. Intenta de nuevo." });
      return false;
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section className="space-y-4">
      <EstadoLectura lectura={lectura} que="los chats" />
      {!info.leadsLeidos && chats.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-800">
          No se pudo comprobar qué chats ya son lead. Antes de crear uno se vuelve a comprobar, así que no se duplica.
        </div>
      )}

      {chats.length === 0 ? (
        <div className={`${tarjeta} border-gray-100 flex items-center gap-2 text-sm text-kora-muted`}>
          <Check className="h-4 w-4 text-kora-accent" /> Ningún visitante ha pedido hablar con una persona.
        </div>
      ) : (
        <ul className="space-y-3">
          {chats.map((c) => (
            <TarjetaChat
              key={c.id}
              c={c}
              ahora={ahora}
              puedeAtender={info.puedeAtender}
              ocupado={ocupado === c.id}
              formularioAbierto={formulario === c.id}
              abrirFormulario={() => {
                setAviso(null);
                setFormulario(formulario === c.id ? null : c.id);
              }}
              onAtender={() => atender(c)}
              onCrearLead={(d) => crearLead(c, d)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TarjetaChat({
  c,
  ahora,
  puedeAtender,
  ocupado,
  formularioAbierto,
  abrirFormulario,
  onAtender,
  onCrearLead,
}: {
  c: ChatBandeja;
  ahora: string;
  puedeAtender: boolean;
  ocupado: boolean;
  formularioAbierto: boolean;
  abrirFormulario: () => void;
  onAtender: () => void;
  onCrearLead: (d: DatosFormularioLead) => Promise<boolean>;
}) {
  const estado = ESTADO_CHAT[c.estado];
  const primero = c.mensajes.find((m) => m.rol === "user");
  const tieneContacto = c.contacto.emails.length > 0 || c.contacto.telefonos.length > 0;

  return (
    <li className={`${tarjeta} ${c.estado === "atendido" ? "border-gray-100" : "border-amber-200"}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-kora-muted">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${estado.clase}`}>{estado.texto}</span>
        <span title={fechaHora(c.ultimoMensaje)}>{hace(c.ultimoMensaje, ahora)}</span>
        {c.pagina && <span className="break-all">· desde {c.pagina}</span>}
        {c.atendido_at && <span>· atendido el {fechaHora(c.atendido_at)}</span>}
      </div>

      {primero && <p className="mt-2 text-sm text-kora-text line-clamp-3 break-words">«{primero.texto}»</p>}

      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {tieneContacto ? (
          <>
            {c.contacto.telefonos.map((t) => {
              const wa = waLink(t);
              return wa ? (
                <a
                  key={t}
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-kora-text hover:border-kora-primary hover:text-kora-primary"
                >
                  <MessageCircle className="h-3 w-3" /> {t}
                </a>
              ) : null;
            })}
            {c.contacto.emails.map((e) => (
              <a
                key={e}
                href={`mailto:${e}`}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-0.5 text-kora-text hover:border-kora-primary hover:text-kora-primary break-all"
              >
                <Mail className="h-3 w-3" /> {e}
              </a>
            ))}
          </>
        ) : (
          <span className="text-kora-muted">No dejó correo ni teléfono en el chat.</span>
        )}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-kora-primary select-none">
          Ver la conversación ({plural(c.mensajes.length, "mensaje", "mensajes")})
        </summary>
        <ul className="mt-2 space-y-2">
          {c.mensajes.map((m, i) => (
            <li
              key={i}
              className={`rounded-lg p-3 text-sm ${
                m.rol === "user" ? "bg-kora-primary/5 text-kora-text sm:ml-8" : "bg-kora-bg text-kora-text sm:mr-8"
              }`}
            >
              <p className="mb-1 text-[11px] font-semibold text-kora-muted">
                {m.rol === "user" ? "Visitante" : "Asistente de la web"}
                {m.ts ? ` · ${fechaHora(m.ts)}` : ""}
              </p>
              <p className="whitespace-pre-wrap break-words">{m.texto}</p>
            </li>
          ))}
        </ul>
      </details>

      <div className="mt-3 flex flex-wrap gap-2">
        {puedeAtender && (
          <button
            type="button"
            onClick={onAtender}
            disabled={ocupado}
            className={c.estado === "atendido" ? botonSecundario : botonPrincipal}
          >
            {ocupado ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : c.estado === "atendido" ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {c.estado === "atendido" ? "Reabrir" : "Marcar atendido"}
          </button>
        )}
        {c.leadId ? (
          <Link href={`/crm/${c.leadId}`} className={botonSecundario}>
            <UserPlus className="h-3.5 w-3.5" /> Ver lead
          </Link>
        ) : (
          <button type="button" onClick={abrirFormulario} disabled={ocupado} className={botonSecundario}>
            <UserPlus className="h-3.5 w-3.5" /> Pasar a lead
          </button>
        )}
      </div>

      {formularioAbierto && !c.leadId && <FormularioLead c={c} ocupado={ocupado} onCrear={onCrearLead} />}
    </li>
  );
}

// ─── Pasar a lead ────────────────────────────────────────────────────────────

interface DatosFormularioLead {
  hotel_nombre: string;
  tomador_nombre: string;
  contacto: string;
  email: string;
  ciudad: string;
  nota: string;
  secuencia: boolean;
}

function FormularioLead({
  c,
  ocupado,
  onCrear,
}: {
  c: ChatBandeja;
  ocupado: boolean;
  onCrear: (d: DatosFormularioLead) => Promise<boolean>;
}) {
  // Se prellena SÓLO lo que el visitante escribió. El nombre del hotel no se
  // adivina: el chat no lo pide, y un prospecto con el hotel equivocado es peor
  // que un campo vacío.
  const [d, setD] = useState<DatosFormularioLead>({
    hotel_nombre: "",
    tomador_nombre: "",
    contacto: c.contacto.telefonos[0] ?? "",
    email: c.contacto.emails[0] ?? "",
    ciudad: "",
    nota: "",
    secuencia: false,
  });
  const cambiar = (k: keyof DatosFormularioLead) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setD((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <form
      className="mt-4 space-y-3 border-t border-gray-100 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!d.hotel_nombre.trim()) return;
        void onCrear(d);
      }}
    >
      <p className="text-xs text-kora-muted">
        La conversación se copia a las notas del lead. Si ya lo habías pasado, no se crea otro.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-kora-text">
          Nombre del hotel *
          <input required maxLength={200} value={d.hotel_nombre} onChange={cambiar("hotel_nombre")} className={`mt-1 ${campo}`} />
        </label>
        <label className="block text-xs font-semibold text-kora-text">
          Nombre de la persona
          <input maxLength={200} value={d.tomador_nombre} onChange={cambiar("tomador_nombre")} className={`mt-1 ${campo}`} />
        </label>
        <label className="block text-xs font-semibold text-kora-text">
          WhatsApp o teléfono
          <input maxLength={200} value={d.contacto} onChange={cambiar("contacto")} inputMode="tel" className={`mt-1 ${campo}`} />
        </label>
        <label className="block text-xs font-semibold text-kora-text">
          Correo
          <input type="email" maxLength={200} value={d.email} onChange={cambiar("email")} className={`mt-1 ${campo}`} />
        </label>
        <label className="block text-xs font-semibold text-kora-text">
          Ciudad
          <input maxLength={200} value={d.ciudad} onChange={cambiar("ciudad")} className={`mt-1 ${campo}`} />
        </label>
      </div>
      <label className="block text-xs font-semibold text-kora-text">
        Nota (opcional)
        <textarea maxLength={1000} rows={2} value={d.nota} onChange={cambiar("nota")} className={`mt-1 ${campo}`} />
      </label>
      <label className="flex items-start gap-2 text-xs text-kora-text">
        <input
          type="checkbox"
          checked={d.secuencia}
          onChange={(e) => setD((prev) => ({ ...prev, secuencia: e.target.checked }))}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-kora-primary"
        />
        <span>
          Mandarle también los correos automáticos de seguimiento. Déjalo apagado si vas a escribirle tú: pidió hablar
          con una persona.
        </span>
      </label>
      <button type="submit" disabled={ocupado || !d.hotel_nombre.trim()} className={botonPrincipal}>
        {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        Crear lead
      </button>
    </form>
  );
}
