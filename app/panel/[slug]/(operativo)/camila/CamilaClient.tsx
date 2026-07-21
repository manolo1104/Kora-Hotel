"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Sparkles,
  MessageCircle,
  Check,
  Loader2,
  Copy,
  Eye,
  Send,
  Power,
  Phone,
  QrCode,
  Info,
  CalendarDays,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { DiagnosticoHotel, DiagnosticoItem } from "@/lib/panel/diagnostico";
import type { BotAvailability } from "@/lib/bot/tools";

interface BotFaq {
  q: string;
  a: string;
}
interface BotPagoFields {
  titular: string;
  banco: string;
  clabe: string;
  cuenta: string;
  notas: string;
}
interface BotFields {
  nombre: string;
  tono: string;
  saludo: string;
  instrucciones: string;
  escalarWhatsapp: string;
  pago: BotPagoFields;
  faqs: BotFaq[];
  entrenadoAt: string | null;
  probadoAt: string | null;
}

const EMPTY_PAGO: BotPagoFields = { titular: "", banco: "", clabe: "", cuenta: "", notas: "" };
interface Msg {
  role: "user" | "assistant";
  content: string;
}

const EMPTY_BOT: BotFields = {
  nombre: "",
  tono: "",
  saludo: "",
  instrucciones: "",
  escalarWhatsapp: "",
  pago: { ...EMPTY_PAGO },
  faqs: [],
  entrenadoAt: null,
  probadoAt: null,
};

const TOTAL_PASOS = 6;

// Fecha ISO a N días de hoy (para valores por defecto del verificador).
function isoEnDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toLocaleDateString("en-CA");
}

export default function CamilaClient({
  slug,
  hotelNombre,
  whatsappHotel,
  diagnostico,
}: {
  slug: string;
  hotelNombre: string;
  whatsappHotel: string;
  diagnostico: DiagnosticoHotel;
}) {
  const [cargando, setCargando] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [bot, setBot] = useState<BotFields>(EMPTY_BOT);

  // Número autorizado para apagar/encender a Camila por WhatsApp.
  const [adminPhone, setAdminPhone] = useState("");
  const [adminGuardado, setAdminGuardado] = useState(false);

  // ¿El usuario ya probó a Camila? (persiste como extras.bot.probadoAt)
  const [probado, setProbado] = useState(false);

  // Paso activo del asistente (0..TOTAL_PASOS-1).
  const [paso, setPaso] = useState(0);

  const [entrenando, setEntrenando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [token, setToken] = useState("");
  const [tokenCargando, setTokenCargando] = useState(false);
  const [tokenCopiado, setTokenCopiado] = useState(false);

  // Estado/QR del bot (viene del runtime en Railway vía /api/admin/bot-qr)
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [qrImg, setQrImg] = useState<string | null>(null);

  // Chat de prueba
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const chatFin = useRef<HTMLDivElement | null>(null);

  // Verificador de disponibilidad (paso 5)
  const [vChkin, setVChkin] = useState("");
  const [vChkout, setVChkout] = useState("");
  const [vCargando, setVCargando] = useState(false);
  const [vError, setVError] = useState<string | null>(null);
  const [vResultado, setVResultado] = useState<BotAvailability | null>(null);

  useEffect(() => {
    // Fechas por defecto del verificador: dentro de una semana, dos noches.
    setVChkin(isoEnDias(7));
    setVChkout(isoEnDias(9));
    fetch("/api/admin/bot-config")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no-auth"))))
      .then((d) => {
        setEnabled(Boolean(d.enabled));
        setLang(d.lang === "en" ? "en" : "es");
        setAdminPhone(typeof d.adminPhone === "string" ? d.adminPhone : "");
        setProbado(Boolean(d.bot?.probadoAt));
        setBot({
          ...EMPTY_BOT,
          ...(d.bot ?? {}),
          escalarWhatsapp: d.bot?.escalarWhatsapp || whatsappHotel || "",
          pago: { ...EMPTY_PAGO, ...(d.bot?.pago ?? {}) },
          faqs: Array.isArray(d.bot?.faqs) ? d.bot.faqs : [],
        });
      })
      .catch(() => setAviso("No pude cargar la configuración."))
      .finally(() => setCargando(false));
  }, [whatsappHotel]);

  useEffect(() => {
    chatFin.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, enviando]);

  // Sondea el estado/QR del bot cada 15 s (el QR rota; así se refresca solo).
  useEffect(() => {
    let activo = true;
    async function fetchQr() {
      try {
        const res = await fetch("/api/admin/bot-qr", { cache: "no-store" });
        const d = await res.json().catch(() => ({}));
        if (!activo) return;
        setQrStatus(typeof d.status === "string" ? d.status : "sin-servicio");
        setQrImg(typeof d.qr === "string" ? d.qr : null);
      } catch {
        if (activo) setQrStatus("sin-servicio");
      }
    }
    fetchQr();
    const id = setInterval(fetchQr, 15000);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, []);

  async function postConfig(body: Record<string, unknown>) {
    const res = await fetch("/api/admin/bot-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    if (!(await postConfig({ enabled: next }))) setEnabled(!next);
  }

  async function cambiarIdioma(l: "es" | "en") {
    const prev = lang;
    setLang(l);
    if (!(await postConfig({ lang: l }))) setLang(prev);
  }

  async function guardarAdminPhone() {
    const ok = await postConfig({ adminPhone });
    if (ok) {
      setAdminGuardado(true);
      setTimeout(() => setAdminGuardado(false), 2000);
    }
  }

  // Marca "ya probé el bot" una sola vez (persiste, sin marcar "entrenado").
  async function marcarProbado() {
    if (probado) return;
    setProbado(true);
    await postConfig({ probado: true });
  }

  async function entrenarIA() {
    setEntrenando(true);
    setAviso(null);
    try {
      const res = await fetch("/api/admin/bot-train", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.draft) {
        setBot((b) => ({
          ...b,
          nombre: d.draft.nombre || b.nombre || "Camila",
          tono: d.draft.tono || b.tono,
          saludo: d.draft.saludo || b.saludo,
          instrucciones: d.draft.instrucciones || b.instrucciones,
        }));
        setAviso("Camila redactó una propuesta con los datos de tu hotel. Revísala y ajústala. 👇");
      } else {
        setAviso(
          d.error === "sin-ia" || res.status === 503
            ? "Falta configurar la IA (contacta a Kora)."
            : "No pude entrenar ahora, inténtalo de nuevo.",
        );
      }
    } catch {
      setAviso("No pude entrenar ahora, inténtalo de nuevo.");
    } finally {
      setEntrenando(false);
    }
  }

  async function guardar() {
    setGuardando(true);
    setGuardado(false);
    const ok = await postConfig({
      lang,
      bot: {
        nombre: bot.nombre,
        tono: bot.tono,
        saludo: bot.saludo,
        instrucciones: bot.instrucciones,
        escalarWhatsapp: bot.escalarWhatsapp,
        pago: bot.pago,
        faqs: bot.faqs.filter((f) => f.q.trim()),
      },
    });
    setGuardando(false);
    if (ok) {
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } else {
      setAviso("No pude guardar. Inténtalo de nuevo.");
    }
  }

  async function verToken() {
    setTokenCargando(true);
    try {
      const res = await fetch("/api/admin/agent-token");
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.token) setToken(d.token);
    } finally {
      setTokenCargando(false);
    }
  }

  async function copiarToken() {
    try {
      await navigator.clipboard.writeText(token);
      setTokenCopiado(true);
      setTimeout(() => setTokenCopiado(false), 1500);
    } catch {
      /* noop */
    }
  }

  async function enviarPrueba() {
    const texto = input.trim();
    if (!texto || enviando) return;
    const nuevos: Msg[] = [...mensajes, { role: "user", content: texto }];
    setMensajes(nuevos);
    setInput("");
    setEnviando(true);
    try {
      const res = await fetch("/api/admin/bot-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: nuevos }),
      });
      const d = await res.json().catch(() => ({}));
      const reply =
        res.ok && d.reply
          ? d.reply
          : d.error === "sin-ia" || res.status === 503
            ? "(Falta configurar la IA para la prueba.)"
            : "(No pude responder ahora, inténtalo de nuevo.)";
      setMensajes((m) => [...m, { role: "assistant", content: reply }]);
      if (res.ok && d.reply) marcarProbado();
    } catch {
      setMensajes((m) => [...m, { role: "assistant", content: "(Error de red.)" }]);
    } finally {
      setEnviando(false);
    }
  }

  async function verificarDisponibilidad() {
    if (vCargando) return;
    if (!vChkin || !vChkout || vChkout <= vChkin) {
      setVError("Elige una fecha de salida posterior a la de llegada.");
      setVResultado(null);
      return;
    }
    setVCargando(true);
    setVError(null);
    setVResultado(null);
    try {
      const res = await fetch("/api/admin/bot-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin: vChkin, checkout: vChkout }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setVResultado(d as BotAvailability);
        marcarProbado();
      } else {
        setVError(
          d.error === "fechas-invalidas"
            ? "Esas fechas no son válidas."
            : "No pude verificar ahora, inténtalo de nuevo.",
        );
      }
    } catch {
      setVError("Error de red al verificar.");
    } finally {
      setVCargando(false);
    }
  }

  function setFaq(i: number, campo: "q" | "a", v: string) {
    setBot((b) => {
      const faqs = [...b.faqs];
      faqs[i] = { ...faqs[i], [campo]: v };
      return { ...b, faqs };
    });
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-kora-muted">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  const nombreBot = bot.nombre.trim() || "Camila";
  const editar = (tab?: string) => `/panel/${slug}/sitio${tab ? `?tab=${tab}` : ""}`;

  // ── Progreso de configuración (los 6 pasos cuentan) ──
  const e1Listo = enabled;
  const e2Listo = Boolean(bot.nombre.trim() && (bot.tono.trim() || bot.saludo.trim()));
  const e3Listo =
    diagnostico.habitaciones.ok && diagnostico.precios.ok && diagnostico.fotos.ok;
  const e4Listo = Boolean(bot.instrucciones.trim() || bot.faqs.some((f) => f.q.trim()));
  const e5Listo = probado;
  const e6Listo = qrStatus === "ready";
  const listosArr = [e1Listo, e2Listo, e3Listo, e4Listo, e5Listo, e6Listo];
  const listos = listosArr.filter(Boolean).length;

  const temporadas = diagnostico.temporadas;
  const sabeItems: DiagnosticoItem[] = [
    diagnostico.habitaciones,
    diagnostico.precios,
    diagnostico.camas,
    diagnostico.fotos,
    diagnostico.amenidades,
    diagnostico.politicas,
    diagnostico.faqs,
    diagnostico.guia,
  ];

  const PASOS = [
    { n: 1, label: "Activar", titulo: "Enciende a Camila", icon: <Power size={18} />, listo: e1Listo },
    { n: 2, label: "Identidad", titulo: `Identidad de ${nombreBot}`, icon: <Sparkles size={18} />, listo: e2Listo },
    { n: 3, label: "Datos", titulo: `Lo que ${nombreBot} sabe de tu hotel`, icon: <Info size={18} />, listo: e3Listo },
    { n: 4, label: "Reglas", titulo: "Reglas de conversación", icon: <MessageCircle size={18} />, listo: e4Listo },
    { n: 5, label: "Probar", titulo: `Prueba a ${nombreBot}`, icon: <MessageCircle size={18} />, listo: e5Listo },
    { n: 6, label: "Conectar", titulo: "Conecta tu WhatsApp", icon: <QrCode size={18} />, listo: e6Listo },
  ];
  const activo = PASOS[paso];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Encabezado */}
      <header>
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-11 h-11 rounded-2xl bg-kora-primary/10 text-kora-primary">
            <Bot size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-kora-text tracking-tight">
              {nombreBot} · tu asistente de WhatsApp
            </h1>
            <p className="text-sm text-kora-muted">
              Contesta a tus huéspedes 24/7 con la información de <strong>{hotelNombre}</strong> y cierra reservas.
            </p>
          </div>
        </div>
      </header>

      {/* Progreso + navegación por pasos (cabecera del asistente) */}
      <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-kora-text">Configuración de {nombreBot}</p>
          <p className="text-sm font-semibold text-kora-primary">{listos}/{TOTAL_PASOS} listo</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full rounded-full bg-kora-primary transition-all"
            style={{ width: `${(listos / TOTAL_PASOS) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PASOS.map((p, i) => (
            <StepPill
              key={p.n}
              n={p.n}
              label={p.label}
              ok={p.listo}
              activo={paso === i}
              onClick={() => setPaso(i)}
            />
          ))}
        </div>
      </div>

      {aviso && (
        <div className="flex items-start gap-2 rounded-xl bg-kora-primary/5 border border-kora-primary/20 px-4 py-3 text-sm text-kora-text">
          <Info size={16} className="mt-0.5 shrink-0 text-kora-primary" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Paso activo (uno a la vez, para no abrumar) */}
      <Etapa n={activo.n} titulo={activo.titulo} listo={activo.listo} icon={activo.icon}>
        {paso === 0 && (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-kora-muted">
                {enabled
                  ? `${nombreBot} está encendida: responde a tus huéspedes cuando el bot esté conectado.`
                  : `${nombreBot} está apagada: no responderá aunque esté conectada.`}
              </p>
              <button
                onClick={toggleEnabled}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-kora-primary" : "bg-gray-300"}`}
                aria-label={enabled ? "Apagar bot" : "Encender bot"}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-kora-muted">Idioma principal:</span>
              {(["es", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => cambiarIdioma(l)}
                  className={`px-3 py-1 rounded-full font-semibold transition-colors ${lang === l ? "bg-kora-primary text-white" : "bg-black/5 text-kora-text hover:bg-black/10"}`}
                >
                  {l === "es" ? "Español" : "English"}
                </button>
              ))}
            </div>

            {/* Control por WhatsApp desde un número autorizado */}
            <div className="rounded-xl border border-black/10 bg-kora-bg/40 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-kora-text">
                <Phone size={15} className="text-kora-primary" />
                Apágala o enciéndela por WhatsApp
              </div>
              <p className="text-xs text-kora-muted">
                Pon aquí tu WhatsApp personal. Desde ese número podrás mandarle <strong>&ldquo;apagar&rdquo;</strong> o{" "}
                <strong>&ldquo;encender&rdquo;</strong> al número del hotel y Camila obedecerá. (Opcional.)
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  onBlur={guardarAdminPhone}
                  inputMode="tel"
                  placeholder="52 55 1234 5678"
                  className="input-kora flex-1"
                />
                <button
                  onClick={guardarAdminPhone}
                  className="btn-press inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-kora-text text-white font-semibold text-sm hover:opacity-90"
                >
                  {adminGuardado ? <Check size={15} /> : null}
                  {adminGuardado ? "Guardado" : "Guardar"}
                </button>
              </div>
            </div>
          </>
        )}

        {paso === 1 && (
          <>
            <p className="text-sm text-kora-muted">
              Cómo se llama, cómo suena y cómo saluda. Deja que la IA proponga una versión con los datos de tu hotel y ajústala.
            </p>
            <button
              onClick={entrenarIA}
              disabled={entrenando}
              className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-kora-primary text-white font-semibold text-sm hover:bg-kora-primary-dark transition-colors disabled:opacity-60"
            >
              {entrenando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {entrenando ? "Redactando…" : "Proponer con IA"}
            </button>

            <div className="space-y-4 pt-1">
              <Campo label="Nombre de la asistente">
                <input
                  value={bot.nombre}
                  onChange={(e) => setBot((b) => ({ ...b, nombre: e.target.value }))}
                  placeholder="Camila"
                  className="input-kora"
                />
              </Campo>
              <Campo label="Personalidad y tono (cómo debe sonar)">
                <textarea
                  value={bot.tono}
                  onChange={(e) => setBot((b) => ({ ...b, tono: e.target.value }))}
                  rows={3}
                  placeholder="Cálida, cercana y profesional; transmite la calma del hotel…"
                  className="input-kora"
                />
              </Campo>
              <Campo label="Saludo de primer contacto">
                <textarea
                  value={bot.saludo}
                  onChange={(e) => setBot((b) => ({ ...b, saludo: e.target.value }))}
                  rows={2}
                  placeholder="¡Hola! 🌿 Soy Camila, del Hotel…"
                  className="input-kora"
                />
              </Campo>
            </div>
            <BotonGuardar guardando={guardando} guardado={guardado} onClick={guardar} />
          </>
        )}

        {paso === 2 && (
          <>
            <p className="text-sm text-kora-muted">
              Todo esto sale <strong>estrictamente</strong> de tu hotel. {nombreBot} nunca inventa ni mezcla datos de otro. Completa lo que falte para que responda mejor.
            </p>

            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                temporadas.estado === "ok"
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              <div className="flex items-start gap-2">
                {temporadas.estado === "ok" ? (
                  <Check size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold">Precios por fecha (temporadas)</p>
                  <p>{temporadas.mensaje}</p>
                  <a
                    href={editar("avanzado")}
                    className="mt-1 inline-flex items-center gap-1 font-semibold underline"
                  >
                    {temporadas.tiene ? "Editar temporadas" : "Cargar temporadas"} <ArrowRight size={13} />
                  </a>
                </div>
              </div>
            </div>

            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-kora-text">
              {sabeItems.map((it) => (
                <SabeItem key={it.label} item={it} editar={editar} />
              ))}
            </ul>
          </>
        )}

        {paso === 3 && (
          <>
            <p className="text-sm text-kora-muted">
              Instrucciones especiales, a quién pasar los casos que no resuelva, y respuestas extra solo para el bot.
            </p>
            <div className="space-y-4">
              <Campo label="Instrucciones especiales del hotel">
                <textarea
                  value={bot.instrucciones}
                  onChange={(e) => setBot((b) => ({ ...b, instrucciones: e.target.value }))}
                  rows={4}
                  placeholder="- Destaca el desayuno incluido&#10;- Si preguntan por mascotas, di que sí se permiten…"
                  className="input-kora"
                />
              </Campo>
              <Campo label="Pasar con una persona (WhatsApp para casos que no resuelva)">
                <input
                  value={bot.escalarWhatsapp}
                  onChange={(e) => setBot((b) => ({ ...b, escalarWhatsapp: e.target.value }))}
                  placeholder={whatsappHotel || "52 55 1234 5678"}
                  className="input-kora"
                />
              </Campo>

              {/* Formas de pago: para que Camila ofrezca transferencia/depósito/OXXO */}
              <div className="rounded-2xl border border-black/10 bg-black/[0.015] p-4">
                <p className="text-sm font-bold text-kora-text">Datos para pago por transferencia</p>
                <p className="mb-3 mt-0.5 text-xs text-kora-muted">
                  Si los llenas, Camila podrá ofrecer pago por transferencia, depósito u OXXO
                  (además del link de reserva en línea). Déjalos en blanco si solo usas pago en
                  línea.
                </p>
                <div className="space-y-3">
                  <Campo label="Titular / beneficiario">
                    <input
                      value={bot.pago.titular}
                      onChange={(e) =>
                        setBot((b) => ({ ...b, pago: { ...b.pago, titular: e.target.value } }))
                      }
                      placeholder="Nombre de la cuenta"
                      className="input-kora"
                    />
                  </Campo>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo label="Banco">
                      <input
                        value={bot.pago.banco}
                        onChange={(e) =>
                          setBot((b) => ({ ...b, pago: { ...b.pago, banco: e.target.value } }))
                        }
                        placeholder="BBVA, Banorte…"
                        className="input-kora"
                      />
                    </Campo>
                    <Campo label="CLABE (18 dígitos)">
                      <input
                        value={bot.pago.clabe}
                        onChange={(e) =>
                          setBot((b) => ({ ...b, pago: { ...b.pago, clabe: e.target.value } }))
                        }
                        inputMode="numeric"
                        placeholder="0000 0000 0000 0000 00"
                        className="input-kora"
                      />
                    </Campo>
                  </div>
                  <Campo label="Número de cuenta o tarjeta (opcional)">
                    <input
                      value={bot.pago.cuenta}
                      onChange={(e) =>
                        setBot((b) => ({ ...b, pago: { ...b.pago, cuenta: e.target.value } }))
                      }
                      placeholder="Opcional"
                      className="input-kora"
                    />
                  </Campo>
                  <Campo label="Notas de pago (OXXO, referencia, instrucciones)">
                    <textarea
                      value={bot.pago.notas}
                      onChange={(e) =>
                        setBot((b) => ({ ...b, pago: { ...b.pago, notas: e.target.value } }))
                      }
                      rows={2}
                      placeholder="Ej. También aceptamos depósito en OXXO a la tarjeta. Manda tu comprobante para confirmar."
                      className="input-kora"
                    />
                  </Campo>
                </div>
              </div>

              <Campo label="Preguntas y respuestas extra (solo para el bot)">
                <div className="space-y-2">
                  {bot.faqs.map((f, i) => (
                    <div key={i} className="grid gap-1.5 rounded-xl border border-black/10 p-2">
                      <input
                        value={f.q}
                        onChange={(e) => setFaq(i, "q", e.target.value)}
                        placeholder="Pregunta (ej. ¿Tienen estacionamiento?)"
                        className="input-kora text-sm"
                      />
                      <textarea
                        value={f.a}
                        onChange={(e) => setFaq(i, "a", e.target.value)}
                        rows={2}
                        placeholder="Respuesta"
                        className="input-kora text-sm"
                      />
                      <button
                        onClick={() => setBot((b) => ({ ...b, faqs: b.faqs.filter((_, j) => j !== i) }))}
                        className="self-end text-xs text-red-500 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setBot((b) => ({ ...b, faqs: [...b.faqs, { q: "", a: "" }] }))}
                    className="text-sm font-semibold text-kora-primary hover:underline"
                  >
                    + Agregar pregunta
                  </button>
                </div>
              </Campo>
            </div>
            <BotonGuardar guardando={guardando} guardado={guardado} onClick={guardar} />
          </>
        )}

        {paso === 4 && (
          <>
            <p className="text-sm text-kora-muted">
              Platica con ella aquí mismo (sin WhatsApp) para ver cómo responde con tus datos. Guarda tu entrenamiento antes para probar la última versión.
            </p>
            <div className="rounded-xl border border-black/10 bg-kora-bg/50 h-72 overflow-y-auto p-3 space-y-2">
              {mensajes.length === 0 && (
                <p className="text-sm text-kora-muted text-center py-8">
                  Escribe algo como <em>&ldquo;¿Tienen disponibilidad este fin?&rdquo;</em>
                </p>
              )}
              {mensajes.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-kora-primary text-white" : "bg-white border border-black/10 text-kora-text"}`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {enviando && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-3 py-2 bg-white border border-black/10 text-kora-muted">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatFin} />
            </div>
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviarPrueba()}
                placeholder="Escríbele a Camila…"
                className="input-kora flex-1"
              />
              <button
                onClick={enviarPrueba}
                disabled={enviando || !input.trim()}
                className="btn-press grid place-items-center w-11 h-11 rounded-full bg-kora-primary text-white disabled:opacity-50"
                aria-label="Enviar"
              >
                <Send size={17} />
              </button>
            </div>

            {/* Verificador de disponibilidad: exactamente lo que Camila ofrecería */}
            <div className="rounded-xl border border-black/10 bg-white p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-kora-primary" />
                <p className="text-sm font-semibold text-kora-text">
                  Verifica qué fechas y precios ofrecería {nombreBot}
                </p>
              </div>
              <p className="text-xs text-kora-muted">
                Elige unas fechas y confirma con tus ojos qué cuartos y precios cotizaría (es exactamente lo que usa el bot en vivo).
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-semibold text-kora-muted">
                  Llegada
                  <input
                    type="date"
                    value={vChkin}
                    min={isoEnDias(0)}
                    onChange={(e) => setVChkin(e.target.value)}
                    className="input-kora mt-1 block"
                  />
                </label>
                <label className="text-xs font-semibold text-kora-muted">
                  Salida
                  <input
                    type="date"
                    value={vChkout}
                    min={vChkin || isoEnDias(1)}
                    onChange={(e) => setVChkout(e.target.value)}
                    className="input-kora mt-1 block"
                  />
                </label>
                <button
                  onClick={verificarDisponibilidad}
                  disabled={vCargando}
                  className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-kora-text text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60"
                >
                  {vCargando ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                  Ver qué ofrecería
                </button>
              </div>

              {vError && <p className="text-sm text-red-600">{vError}</p>}

              {vResultado && (
                <div className="rounded-lg border border-black/10 bg-kora-bg/40 p-3">
                  {vResultado.hayDisponibilidad ? (
                    <>
                      <p className="text-xs font-semibold text-kora-text mb-2">
                        {nombreBot} ofrecería estas opciones para esas fechas:
                      </p>
                      <ul className="space-y-1.5">
                        {vResultado.disponibles.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-3 text-sm border-b border-black/5 pb-1.5 last:border-0 last:pb-0"
                          >
                            <span className="min-w-0">
                              <span className="font-semibold text-kora-text">{r.nombre}</span>
                              <span className="text-kora-muted"> · hasta {r.maxHuespedes} huésp.</span>
                            </span>
                            <span className="shrink-0 font-bold tabular-nums text-kora-primary">{r.totalTexto}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="flex items-start gap-2 text-sm text-amber-800">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                      Para esas fechas {nombreBot} diría que <strong>no hay disponibilidad</strong>. Revisa que no estén bloqueadas en tu calendario.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {paso === 5 && (
          <>
            <div className="flex items-center gap-2">
              <BadgeEstado status={qrStatus} nombreBot={nombreBot} />
            </div>

            {qrStatus === "ready" ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <p className="font-semibold">¡Listo! {nombreBot} está conectada a tu WhatsApp.</p>
                <p>Ya responde a tus huéspedes 24/7 (si está encendida en el paso 1).</p>
              </div>
            ) : qrStatus === "sin-servicio" || qrStatus === "desconocido" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">Estamos preparando tu conexión.</p>
                <p>
                  El equipo de Kora deja tu número conectado y en línea 24/7. En cuanto tu bot esté arriba, aquí aparecerá el código QR para escanear.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-kora-muted">
                  Escanea este código <strong>una sola vez</strong> con el WhatsApp del teléfono de tu hotel:
                </p>
                <ol className="ml-4 list-decimal space-y-1 text-sm text-kora-text">
                  <li>Abre <strong>WhatsApp</strong> en el teléfono de tu hotel.</li>
                  <li>Entra a <strong>Ajustes</strong> → <strong>Dispositivos vinculados</strong>.</li>
                  <li>Toca <strong>Vincular un dispositivo</strong>.</li>
                  <li>Apunta la cámara al código de aquí abajo.</li>
                </ol>
                <div className="flex justify-center py-2">
                  {qrImg ? (
                    <div className="rounded-xl border border-black/10 bg-white p-3">
                      {/* QR = data URL que rota; <img> plano es lo correcto (no next/image) */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrImg} alt="Código QR para vincular WhatsApp" width={240} height={240} />
                    </div>
                  ) : (
                    <div className="flex h-[240px] w-[240px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 text-kora-muted">
                      <Loader2 size={22} className="animate-spin" />
                      <span className="text-xs">Preparando el código…</span>
                    </div>
                  )}
                </div>
                <p className="text-center text-xs text-kora-muted">
                  El código se actualiza solo cada pocos segundos. Si expira, espera a que aparezca uno nuevo.
                </p>
              </>
            )}

            {/* Token (avanzado): respaldo por si el equipo Kora lo necesita */}
            <details className="rounded-lg bg-kora-bg/40 px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-kora-muted">
                Token de mi bot (avanzado)
              </summary>
              <div className="pt-2">
                {token ? (
                  <div className="flex items-center gap-2">
                    <input readOnly value={token} className="input-kora flex-1 font-mono text-xs" />
                    <button
                      onClick={copiarToken}
                      className="btn-press inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/5 text-kora-text text-sm font-semibold hover:bg-black/10"
                    >
                      {tokenCopiado ? <Check size={15} /> : <Copy size={15} />}
                      {tokenCopiado ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={verToken}
                    disabled={tokenCargando}
                    className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/5 text-kora-text font-semibold text-sm hover:bg-black/10 disabled:opacity-60"
                  >
                    {tokenCargando ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                    Ver el token de mi bot
                  </button>
                )}
                <p className="mt-1 text-xs text-kora-muted">Trátalo como una contraseña.</p>
              </div>
            </details>
          </>
        )}
      </Etapa>

      {/* Navegación del asistente */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setPaso((p) => Math.max(0, p - 1))}
          disabled={paso === 0}
          className="btn-press inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-black/5 text-kora-text font-semibold text-sm hover:bg-black/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} /> Atrás
        </button>
        <span className="text-xs font-semibold text-kora-muted">
          Paso {paso + 1} de {TOTAL_PASOS}
        </span>
        <button
          onClick={() => setPaso((p) => Math.min(TOTAL_PASOS - 1, p + 1))}
          disabled={paso === TOTAL_PASOS - 1}
          className="btn-press inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-kora-primary text-white font-semibold text-sm hover:bg-kora-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Siguiente <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function BadgeEstado({ status, nombreBot }: { status: string | null; nombreBot: string }) {
  const map: Record<string, { dot: string; txt: string }> = {
    ready: { dot: "bg-green-500", txt: `${nombreBot} está conectada` },
    qr: { dot: "bg-amber-500", txt: "Escanea el código QR" },
    starting: { dot: "bg-gray-400", txt: "Preparando la conexión…" },
    disconnected: { dot: "bg-red-500", txt: "Desconectada — reconectando…" },
    auth_failure: { dot: "bg-red-500", txt: "Falló la vinculación — escanea de nuevo" },
    error: { dot: "bg-red-500", txt: "Servicio no disponible" },
    "sin-servicio": { dot: "bg-gray-400", txt: "Preparando tu conexión" },
    desconocido: { dot: "bg-gray-400", txt: "Preparando tu conexión" },
  };
  const s = map[status ?? "sin-servicio"] ?? map["sin-servicio"];
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-kora-text">
      <span className={`h-2 w-2 rounded-full ${s.dot} ${status === "qr" || status === "starting" ? "animate-pulse" : ""}`} />
      {status === null ? "Consultando estado…" : s.txt}
    </span>
  );
}

function Etapa({
  n,
  titulo,
  listo,
  icon,
  children,
}: {
  n: number;
  titulo: string;
  listo?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
            listo ? "bg-green-100 text-green-700" : "bg-kora-primary/10 text-kora-primary"
          }`}
        >
          {listo ? <Check size={16} /> : n}
        </span>
        <div className="flex items-center gap-2 text-kora-primary">
          {icon}
          <h2 className="text-lg font-bold text-kora-text">{titulo}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function StepPill({
  n,
  label,
  ok,
  activo,
  onClick,
}: {
  n: number;
  label: string;
  ok?: boolean;
  activo?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
        activo
          ? "border-kora-primary bg-kora-primary/10 text-kora-primary"
          : "border-black/10 text-kora-muted hover:bg-black/5"
      }`}
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${
          ok ? "bg-green-500 text-white" : activo ? "bg-kora-primary text-white" : "bg-black/10 text-kora-muted"
        }`}
      >
        {ok ? <Check size={10} /> : n}
      </span>
      {label}
    </button>
  );
}

function BotonGuardar({
  guardando,
  guardado,
  onClick,
}: {
  guardando: boolean;
  guardado: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={guardando}
      className="btn-press inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-kora-text text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
    >
      {guardando ? <Loader2 size={16} className="animate-spin" /> : guardado ? <Check size={16} /> : null}
      {guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar"}
    </button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-kora-text mb-1">{label}</span>
      {children}
    </label>
  );
}

function SabeItem({
  item,
  editar,
}: {
  item: DiagnosticoItem;
  editar: (tab?: string) => string;
}) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 ${item.ok ? "text-green-600" : "text-gray-300"}`}>
        <Check size={15} />
      </span>
      <span className={item.ok ? "" : "text-kora-muted"}>
        {item.label}
        {item.detalle ? <span className="text-kora-muted"> · {item.detalle}</span> : null}
        {!item.ok && (
          <a href={editar(item.tab)} className="ml-1 font-semibold text-kora-primary hover:underline">
            Completar
          </a>
        )}
      </span>
    </li>
  );
}
