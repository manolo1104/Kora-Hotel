"use client";

// La pantalla de la asistente de WhatsApp.
//
// ANTES: un asistente de 6 pasos en un solo archivo de 1,750 líneas; lo que la
// asistente SABE se editaba en otra pantalla (Mi sitio → Avanzado) y aquí sólo
// se veía una lista de chequeo; cuatro maneras distintas de guardar y fallos
// silenciosos; jerga («token», «IA», «bot»); y el chat de prueba escondido en el
// paso 5.
//
// AHORA: un encabezado que dice en una línea si está contestando o no; pestañas
// por TEMA (no pasos en orden); todo se guarda solo con un único indicador; y
// «Pruébala» siempre a la mano para ver al instante cómo cambia lo que
// configuras.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  BookOpen,
  LayoutList,
  MessageCircle,
  MessagesSquare,
  QrCode,
  Sparkles,
  Store,
  X,
  Loader2,
} from "lucide-react";
import { Aviso, IndicadorGuardado, Pestanas, Switch, type Pestana } from "@/components/panel/ui";
import type { DiagnosticoHotel } from "@/lib/panel/diagnostico";
import Conversaciones from "./Conversaciones";
import ChatPrueba from "./ChatPrueba";
import { useCamila } from "./useCamila";
import { mismoTelefono, telefonoValido, type Saldo, type Seccion } from "./tipos";
import Resumen, { pendientesDe, type Pendiente } from "./secciones/Resumen";
import Personalidad from "./secciones/Personalidad";
import LoQueSabe from "./secciones/LoQueSabe";
import ComoVende from "./secciones/ComoVende";
import WhatsApp, { ESTADOS_CONEXION, type Motivo } from "./secciones/WhatsApp";

const SECCIONES: Seccion[] = ["resumen", "personalidad", "sabe", "vende", "conversaciones", "whatsapp"];

export default function CamilaClient({
  slug,
  hotelNombre,
  whatsappHotel,
  diagnostico,
  camilaPermitida = true,
  cobrosListos = false,
}: {
  slug: string;
  hotelNombre: string;
  whatsappHotel: string;
  diagnostico: DiagnosticoHotel;
  /** false = hotel en prueba gratis: tiene el panel, pero el chat y el QR se abren al activar el plan. */
  camilaPermitida?: boolean;
  /** La cuenta de Stripe del hotel cobra de verdad (no sólo existe). */
  cobrosListos?: boolean;
}) {
  const c = useCamila();
  const nombreBot = c.bot.nombre.trim() || "Camila";

  // ── pestaña activa (también desde la URL: ?tab=… o ?chat=… del aviso por WhatsApp) ──
  const [seccion, setSeccionState] = useState<Seccion>("resumen");
  const [chatInicial, setChatInicial] = useState<string | null>(null);
  const [chatMovil, setChatMovil] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const chat = q.get("chat");
    const tab = q.get("tab") as Seccion | null;
    if (chat) {
      setChatInicial(chat);
      setSeccionState("conversaciones");
    } else if (tab && SECCIONES.includes(tab)) setSeccionState(tab);
  }, []);
  const setSeccion = useCallback(
    (s: Seccion) => {
      // Al volver de las conversaciones, trae lo que se enseñó con «Corregir».
      if (seccion === "conversaciones" && s !== "conversaciones") void c.recargarFaqs();
      setSeccionState(s);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", s);
      url.searchParams.delete("chat");
      window.history.replaceState({}, "", url);
    },
    [seccion, c],
  );

  // ── conexión (QR) y saldo: se consultan cada 15 s mientras la pestaña está a la vista ──
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [recargando, setRecargando] = useState(false);
  const [avisoPago, setAvisoPago] = useState<{ tono: "ok" | "alerta" | "error"; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    async function consultar() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/bot-qr", { cache: "no-store" });
        const d = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (res.status === 403) {
          setQrStatus("sin-permiso");
          setQrImg(null);
        } else {
          setQrStatus(typeof d.status === "string" ? d.status : "sin-servicio");
          setQrImg(typeof d.qr === "string" ? d.qr : null);
          setMotivos(Array.isArray(d.motivos) ? d.motivos : []);
        }
      } catch {
        if (vivo) setQrStatus("sin-servicio");
      }
      try {
        const res = await fetch("/api/admin/saldo", { cache: "no-store" });
        if (res.ok) {
          const d = await res.json().catch(() => null);
          if (vivo && d?.ok) setSaldo(d as Saldo);
        }
      } catch {
        /* el saldo es informativo */
      }
    }
    void consultar();
    const id = setInterval(consultar, 15000);
    const alVolver = () => void consultar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  // Vuelta del checkout de Stripe (recarga de saldo).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("recarga");
    if (!p) return;
    setAvisoPago(
      p === "ok"
        ? { tono: "ok", texto: "¡Listo! Tu recarga se está acreditando; el saldo se actualiza solo en unos segundos." }
        : { tono: "alerta", texto: "No se completó el pago. Tu saldo sigue igual." },
    );
    const url = new URL(window.location.href);
    url.searchParams.delete("recarga");
    window.history.replaceState({}, "", url);
  }, []);

  async function recargar(mxn: number) {
    setRecargando(true);
    setAvisoPago(null);
    try {
      const res = await fetch("/api/admin/saldo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mxn }),
      });
      const d = await res.json().catch(() => ({}));
      if (d?.ok && typeof d.url === "string") {
        window.location.href = d.url;
        return;
      }
      setAvisoPago({ tono: "error", texto: typeof d?.error === "string" ? d.error : "No se pudo abrir el pago." });
    } catch {
      setAvisoPago({ tono: "error", texto: "No se pudo abrir el pago." });
    } finally {
      setRecargando(false);
    }
  }

  // ── qué le falta ──
  const pendientes = useMemo(
    () =>
      pendientesDe({
        nombreBot,
        slug,
        conectada: qrStatus === "ready",
        personalidad: Boolean(c.bot.tono.trim() || c.bot.saludo.trim()),
        basicos: Boolean(c.datos.ubicacion.trim() && c.datos.checkin && c.datos.checkout && c.datos.formasPago.length),
        cuartosConPrecio: diagnostico.habitaciones.ok && diagnostico.precios.ok,
        avisoConfigurado:
          (telefonoValido(c.bot.escalarWhatsapp) && !mismoTelefono(c.bot.escalarWhatsapp, whatsappHotel)) ||
          telefonoValido(c.adminPhone),
        probada: Boolean(c.bot.probadoAt) || c.bot.pruebas >= 3,
      }),
    [nombreBot, slug, qrStatus, c.bot, c.datos, c.adminPhone, diagnostico, whatsappHotel],
  );
  const faltan = pendientes.filter((p) => !p.hecho).length;

  function irA(p: Pendiente) {
    if (p.ir.href) window.location.href = p.ir.href;
    else if (p.ir.abrirChat) {
      if (window.matchMedia("(min-width: 1024px)").matches) document.getElementById("chat-prueba")?.focus();
      else setChatMovil(true);
    } else if (p.ir.seccion) setSeccion(p.ir.seccion);
  }

  if (c.cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-kora-muted" role="status">
        <Loader2 className="animate-spin" size={22} aria-hidden="true" />
        <span className="sr-only">Cargando…</span>
      </div>
    );
  }

  const pestanas: Pestana<Seccion>[] = [
    {
      id: "resumen",
      label: "Inicio",
      icono: <LayoutList size={15} />,
      marca: faltan ? (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-kora-accent px-1.5 text-[11px] font-bold text-[#0E1A14]">{faltan}</span>
      ) : null,
    },
    { id: "personalidad", label: "Personalidad", icono: <Sparkles size={15} /> },
    { id: "sabe", label: "Lo que sabe", icono: <BookOpen size={15} /> },
    { id: "vende", label: "Cómo vende", icono: <Store size={15} /> },
    { id: "conversaciones", label: "Conversaciones", icono: <MessagesSquare size={15} /> },
    { id: "whatsapp", label: "WhatsApp y ajustes", icono: <QrCode size={15} /> },
  ];

  const conexion = ESTADOS_CONEXION[qrStatus ?? "desconocido"] ?? ESTADOS_CONEXION.desconocido;
  const sinSaldo = saldo?.bloqueoActivo && saldo.mensajes !== null && saldo.mensajes <= 0;
  const contestando = c.enabled && qrStatus === "ready" && !sinSaldo;
  const estadoTexto = !c.enabled
    ? `${nombreBot} está en pausa: no contesta a nadie.`
    : sinSaldo
      ? `Se acabó el saldo: ${nombreBot} no puede contestar hasta que recargues.`
      : qrStatus === "ready"
        ? `${nombreBot} está contestando a tus huéspedes.`
        : `${nombreBot} está encendida, pero falta conectarla a tu WhatsApp.`;

  const conChat = seccion !== "conversaciones";

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:pb-8">
      {/* ── Encabezado ── */}
      <header className="rounded-2xl border border-panel-border-soft bg-panel-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-kora-primary text-white" aria-hidden="true">
              <Bot size={24} />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-panel-surface ${
                  contestando ? "bg-kora-accent" : "bg-panel-faint"
                }`}
              />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-kora-text">{nombreBot}</h1>
              <p className="text-sm text-kora-muted">Tu asistente de WhatsApp en {hotelNombre}</p>
            </div>
          </div>
          <IndicadorGuardado estado={c.estado} onReintentar={c.reintentar} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-kora-bg px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Switch tamano="lg" checked={c.enabled} onChange={c.setEnabled} label={c.enabled ? `Pausar a ${nombreBot}` : `Encender a ${nombreBot}`} />
            <p className="text-sm font-medium text-kora-text">{estadoTexto}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSeccion("whatsapp")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                conexion.tono === "ok"
                  ? "bg-[var(--chip-ok-bg)] text-[var(--chip-ok-text)]"
                  : conexion.tono === "error"
                    ? "bg-[var(--chip-mal-bg)] text-[var(--chip-mal-text)]"
                    : conexion.tono === "alerta"
                      ? "bg-[var(--chip-aviso-bg)] text-[var(--chip-aviso-text)]"
                      : "bg-[var(--chip-neutro-bg)] text-[var(--chip-neutro-text)]"
              }`}
            >
              <MessageCircle size={12} aria-hidden="true" />
              {qrStatus === null ? "Revisando WhatsApp…" : conexion.txt(nombreBot)}
            </button>
            {saldo && saldo.mensajes !== null && (
              <button
                type="button"
                onClick={() => setSeccion("whatsapp")}
                className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${
                  saldo.bloqueoActivo && saldo.mensajes <= saldo.umbralBajo
                    ? "bg-[var(--chip-aviso-bg)] text-[var(--chip-aviso-text)]"
                    : "bg-[var(--chip-neutro-bg)] text-[var(--chip-neutro-text)]"
                }`}
              >
                {saldo.mensajes.toLocaleString("es-MX")} mensajes
              </button>
            )}
          </div>
        </div>
      </header>

      {c.errorCarga && <Aviso tono="error">{c.errorCarga}</Aviso>}
      {avisoPago && (
        <Aviso tono={avisoPago.tono} onCerrar={() => setAvisoPago(null)}>
          {avisoPago.texto}
        </Aviso>
      )}
      {saldo?.bloqueoActivo && saldo.mensajes !== null && saldo.mensajes > 0 && saldo.mensajes <= saldo.umbralBajo && (
        <Aviso tono="alerta" accion={saldo.puedeRecargar && saldo.recargaAbierta ? <button type="button" onClick={() => setSeccion("whatsapp")} className="font-semibold underline">Recargar</button> : undefined}>
          Te quedan <strong>{saldo.mensajes} mensajes</strong>
          {saldo.diasRestantes !== null && ` (unos ${saldo.diasRestantes} días a tu ritmo)`}. Cuando lleguen a cero, {nombreBot} deja de contestar.
        </Aviso>
      )}

      <Pestanas items={pestanas} activa={seccion} onChange={setSeccion} etiqueta={`Secciones de ${nombreBot}`} />

      <div className={conChat ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]" : ""}>
        <div role="tabpanel" id={`panel-${seccion}`} aria-labelledby={`tab-${seccion}`} className="min-w-0">
          {seccion === "resumen" && <Resumen pendientes={pendientes} nombreBot={nombreBot} onIr={irA} />}
          {seccion === "personalidad" && <Personalidad c={c} nombreBot={nombreBot} />}
          {seccion === "sabe" && <LoQueSabe c={c} nombreBot={nombreBot} slug={slug} diagnostico={diagnostico} />}
          {seccion === "vende" && (
            <ComoVende c={c} nombreBot={nombreBot} slug={slug} whatsappHotel={whatsappHotel} cobrosListos={cobrosListos} />
          )}
          {seccion === "conversaciones" && (
            <Conversaciones nombreBot={nombreBot} chatInicial={chatInicial} onCorregido={c.recargarFaqs} />
          )}
          {seccion === "whatsapp" && (
            <WhatsApp
              c={c}
              nombreBot={nombreBot}
              qrStatus={qrStatus}
              qrImg={qrImg}
              motivos={motivos}
              saldo={saldo}
              onRecargar={recargar}
              recargando={recargando}
            />
          )}
        </div>

        {conChat && (
          <aside className="hidden lg:sticky lg:top-6 lg:block" aria-label="Pruébala">
            <div className="h-[calc(100vh-7rem)] max-h-[760px]">
              <ChatPrueba nombreBot={nombreBot} saludo={c.bot.saludo} permitida={camilaPermitida} onPrueba={c.registrarPrueba} />
            </div>
          </aside>
        )}
      </div>

      {/* Móvil: «Pruébala» como hoja inferior */}
      {conChat && (
        <button
          type="button"
          onClick={() => setChatMovil(true)}
          className="btn-press fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-kora-primary px-5 py-3 text-sm font-semibold text-white shadow-lg lg:hidden"
        >
          <MessageCircle size={17} aria-hidden="true" /> Pruébala
        </button>
      )}
      {chatMovil && (
        <div className="fixed inset-0 z-50 flex items-end bg-panel-contrast/40 lg:hidden" role="dialog" aria-modal="true" aria-label="Pruébala" onClick={(e) => e.target === e.currentTarget && setChatMovil(false)}>
          <div className="relative h-[88vh] w-full animate-[subir_220ms_cubic-bezier(.23,1,.32,1)] motion-reduce:animate-none">
            <button
              type="button"
              onClick={() => setChatMovil(false)}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-panel-surface text-kora-muted shadow"
              aria-label="Cerrar"
            >
              <X size={16} aria-hidden="true" />
            </button>
            <ChatPrueba nombreBot={nombreBot} saludo={c.bot.saludo} permitida={camilaPermitida} onPrueba={c.registrarPrueba} />
          </div>
        </div>
      )}
    </div>
  );
}
