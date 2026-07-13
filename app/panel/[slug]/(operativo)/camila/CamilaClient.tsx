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
  Pencil,
  QrCode,
  Info,
} from "lucide-react";

interface BotFaq {
  q: string;
  a: string;
}
interface BotFields {
  nombre: string;
  tono: string;
  saludo: string;
  instrucciones: string;
  escalarWhatsapp: string;
  faqs: BotFaq[];
  entrenadoAt: string | null;
}
interface Conocimiento {
  descripcion: string;
  cuartos: { nombre: string; maxHuespedes: number }[];
  amenidades: string[];
  faqs: BotFaq[];
  politicas: Record<string, unknown>;
  guia: Record<string, unknown>;
}
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
  faqs: [],
  entrenadoAt: null,
};

export default function CamilaClient({
  slug,
  hotelNombre,
  whatsappHotel,
}: {
  slug: string;
  hotelNombre: string;
  whatsappHotel: string;
}) {
  const [cargando, setCargando] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [bot, setBot] = useState<BotFields>(EMPTY_BOT);
  const [conocimiento, setConocimiento] = useState<Conocimiento | null>(null);

  const [entrenando, setEntrenando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [token, setToken] = useState("");
  const [tokenCargando, setTokenCargando] = useState(false);
  const [tokenCopiado, setTokenCopiado] = useState(false);

  // Chat de prueba
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const chatFin = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/admin/bot-config")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no-auth"))))
      .then((d) => {
        setEnabled(Boolean(d.enabled));
        setLang(d.lang === "en" ? "en" : "es");
        setBot({
          ...EMPTY_BOT,
          ...(d.bot ?? {}),
          escalarWhatsapp: d.bot?.escalarWhatsapp || whatsappHotel || "",
          faqs: Array.isArray(d.bot?.faqs) ? d.bot.faqs : [],
        });
        setConocimiento(d.conocimiento ?? null);
      })
      .catch(() => setAviso("No pude cargar la configuración."))
      .finally(() => setCargando(false));
  }, [whatsappHotel]);

  useEffect(() => {
    chatFin.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, enviando]);

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
    } catch {
      setMensajes((m) => [...m, { role: "assistant", content: "(Error de red.)" }]);
    } finally {
      setEnviando(false);
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

      {aviso && (
        <div className="flex items-start gap-2 rounded-xl bg-kora-primary/5 border border-kora-primary/20 px-4 py-3 text-sm text-kora-text">
          <Info size={16} className="mt-0.5 shrink-0 text-kora-primary" />
          <span>{aviso}</span>
        </div>
      )}

      {/* 1 · Activar */}
      <section className="rounded-2xl border border-black/10 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Power size={18} className="text-kora-primary" />
            <h2 className="text-lg font-bold text-kora-text">1. Activar</h2>
          </div>
          <button
            onClick={toggleEnabled}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? "bg-kora-primary" : "bg-gray-300"}`}
            aria-label={enabled ? "Apagar bot" : "Encender bot"}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </div>
        <p className="text-sm text-kora-muted">
          {enabled
            ? `${nombreBot} está encendida: responde a tus huéspedes cuando el bot esté conectado.`
            : `${nombreBot} está apagada: no responderá aunque esté conectada.`}
        </p>
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
      </section>

      {/* 2 · Entrenar */}
      <section className="rounded-2xl border border-black/10 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-kora-primary" />
          <h2 className="text-lg font-bold text-kora-text">2. Entrena a {nombreBot}</h2>
        </div>
        <p className="text-sm text-kora-muted">
          Deja que la IA proponga su personalidad a partir de los datos de tu hotel, y ajústala a tu gusto.
        </p>
        <button
          onClick={entrenarIA}
          disabled={entrenando}
          className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-kora-primary text-white font-semibold text-sm hover:bg-kora-primary-dark transition-colors disabled:opacity-60"
        >
          {entrenando ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {entrenando ? "Redactando…" : "Entrenar con IA"}
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

          {/* FAQs extra del bot */}
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

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={guardar}
            disabled={guardando}
            className="btn-press inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-kora-text text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {guardando ? <Loader2 size={16} className="animate-spin" /> : guardado ? <Check size={16} /> : null}
            {guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar entrenamiento"}
          </button>
        </div>
      </section>

      {/* 3 · Lo que Camila ya sabe */}
      {conocimiento && (
        <section className="rounded-2xl border border-black/10 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-kora-text">3. Lo que {nombreBot} ya sabe de tu hotel</h2>
            <a
              href={`/panel/${slug}/sitio`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-kora-primary hover:underline"
            >
              <Pencil size={13} /> Editar
            </a>
          </div>
          <p className="text-sm text-kora-muted">
            Todo esto sale <strong>estrictamente</strong> de tu hotel. {nombreBot} nunca inventa ni mezcla datos de otro.
          </p>
          <ul className="grid sm:grid-cols-2 gap-2 text-sm text-kora-text">
            <SabeItem ok={conocimiento.cuartos.length > 0}>
              {conocimiento.cuartos.length} tipo(s) de cuarto{conocimiento.cuartos.length ? `: ${conocimiento.cuartos.map((c) => c.nombre).join(", ")}` : ""}
            </SabeItem>
            <SabeItem ok={conocimiento.amenidades.length > 0}>
              {conocimiento.amenidades.length} amenidad(es)
            </SabeItem>
            <SabeItem ok={conocimiento.faqs.length > 0}>
              {conocimiento.faqs.length} pregunta(s) frecuente(s)
            </SabeItem>
            <SabeItem ok={Object.keys(conocimiento.politicas).length > 0}>
              Políticas {Object.keys(conocimiento.politicas).length ? "configuradas" : "sin configurar"}
            </SabeItem>
            <SabeItem ok={Boolean(conocimiento.descripcion)}>Descripción del hotel</SabeItem>
            <SabeItem ok={Object.keys(conocimiento.guia).length > 0}>Guía / recomendaciones</SabeItem>
          </ul>
        </section>
      )}

      {/* 4 · Chat de prueba */}
      <section className="rounded-2xl border border-black/10 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-kora-primary" />
          <h2 className="text-lg font-bold text-kora-text">4. Prueba a {nombreBot}</h2>
        </div>
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
      </section>

      {/* 5 · Conectar */}
      <section className="rounded-2xl border border-black/10 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <QrCode size={18} className="text-kora-primary" />
          <h2 className="text-lg font-bold text-kora-text">5. Conecta tu WhatsApp</h2>
        </div>
        <p className="text-sm text-kora-muted">
          {nombreBot} se conecta a un número de WhatsApp dedicado escaneando un código QR (una sola vez). Necesitas el <strong>token</strong> de tu bot para vincularlo.
        </p>
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
        <p className="text-xs text-kora-muted">
          Trátalo como una contraseña. El equipo de Kora te ayuda a dejar tu número conectado y en línea 24/7.
        </p>
      </section>
    </div>
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

function SabeItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 shrink-0 ${ok ? "text-green-600" : "text-gray-300"}`}>
        <Check size={15} />
      </span>
      <span className={ok ? "" : "text-kora-muted"}>{children}</span>
    </li>
  );
}
