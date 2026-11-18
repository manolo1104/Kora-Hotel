"use client";

// Cómo suena la asistente. Antes era un textarea en blanco con la etiqueta
// «Personalidad y tono (cómo debe sonar)»: el hotelero no sabía qué escribir, y
// lo que escribía competía con las reglas del prompt. Ahora se elige un estilo
// viendo un ejemplo real, y sólo quien quiere lo escribe a mano.

import { useState } from "react";
import { Loader2, Sparkles, UserRound, Smile, MessageSquareText } from "lucide-react";
import { Campo, Chips, Tarjeta, TextoWhatsApp, btnSecundario, btnSuave, Aviso } from "@/components/panel/ui";
import type { Camila } from "../useCamila";
import type { EmojiNivel } from "../tipos";

const ESTILOS = [
  {
    id: "calida",
    titulo: "Cálida y cercana",
    tono: "Cálida, cercana y amable, como una buena anfitriona. Trata de tú. Frases cortas y alegres, sin exagerar.",
    ejemplo: "¡Hola! Qué gusto que nos escribas 😊 Para esas fechas tengo la *Cabaña Río* libre. ¿Te paso el precio para 2?",
  },
  {
    id: "profesional",
    titulo: "Profesional",
    tono: "Profesional, clara y cortés. Trata de usted. Respuestas precisas, sin emojis de más ni confianzas.",
    ejemplo: "Buenas tardes. Para esas fechas contamos con la *Cabaña Río* disponible. ¿Desea que le comparta la tarifa para 2 personas?",
  },
  {
    id: "relajada",
    titulo: "Relajada y divertida",
    tono: "Relajada, divertida y con buena vibra, como alguien del lugar. Trata de tú. Puede bromear un poco, siempre con respeto.",
    ejemplo: "¡Hey! 🌴 Buenas noticias: la *Cabaña Río* está libre esos días. ¿Cuántos van? Te digo el precio al tiro.",
  },
] as const;

const NIVELES: { valor: EmojiNivel; label: string; detalle: string }[] = [
  { valor: "nada", label: "Sin emojis", detalle: "Nunca usa emojis" },
  { valor: "bajo", label: "Pocos", detalle: "Máximo 1, de vez en cuando" },
  { valor: "medio", label: "Normal", detalle: "1 o 2 por mensaje" },
  { valor: "alto", label: "Muchos", detalle: "2 a 4 por mensaje" },
];

export default function Personalidad({ c, nombreBot }: { c: Camila; nombreBot: string }) {
  const { bot, cambiarBot } = c;
  const estiloActual = ESTILOS.find((e) => e.tono === bot.tono.trim())?.id ?? (bot.tono.trim() ? "propio" : null);
  const [propioAbierto, setPropioAbierto] = useState(estiloActual === "propio");
  const [proponiendo, setProponiendo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [aviso, setAviso] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  async function proponer() {
    setConfirmar(false);
    setProponiendo(true);
    setAviso(null);
    try {
      const res = await fetch("/api/admin/bot-train", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.draft) {
        cambiarBot({
          ...(d.draft.tono ? { tono: d.draft.tono } : {}),
          ...(d.draft.saludo ? { saludo: d.draft.saludo } : {}),
          ...(d.draft.instrucciones ? { instrucciones: d.draft.instrucciones } : {}),
        });
        setPropioAbierto(true);
        setAviso({ tono: "ok", texto: "Listo: lo escribí con los datos de tu hotel. Léelo y cambia lo que quieras." });
      } else {
        setAviso({ tono: "error", texto: "No pude escribirlo ahora. Intenta en un momento." });
      }
    } catch {
      setAviso({ tono: "error", texto: "Sin conexión. Intenta de nuevo." });
    } finally {
      setProponiendo(false);
    }
  }

  const hayTexto = [bot.tono, bot.saludo, bot.instrucciones].some((t) => t.trim());

  return (
    <div className="space-y-5">
      <Tarjeta icono={<UserRound size={18} />} titulo="¿Cómo se llama?" descripcion="Así se presenta con tus huéspedes.">
        <Campo label="Nombre de tu asistente" ayuda="Si lo dejas vacío, se llama Camila." max={60} valor={bot.nombre}>
          {(p) => (
            <input
              {...p}
              value={bot.nombre}
              onChange={(e) => cambiarBot({ nombre: e.target.value.slice(0, 60) })}
              placeholder="Camila"
              className="input-kora max-w-sm"
            />
          )}
        </Campo>
      </Tarjeta>

      <Tarjeta
        icono={<MessageSquareText size={18} />}
        titulo="¿Cómo habla?"
        descripcion="Elige el estilo que más se parezca a tu hotel. Mira el ejemplo de cada uno."
        accion={
          confirmar ? null : (
            <button
              type="button"
              onClick={() => (hayTexto ? setConfirmar(true) : proponer())}
              disabled={proponiendo}
              className={btnSuave}
            >
              {proponiendo ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
              Escríbelo por mí
            </button>
          )
        }
      >
        {confirmar && (
          <div className="mb-4">
            <Aviso
              tono="alerta"
              titulo="¿Reemplazo lo que ya escribiste?"
              accion={
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={proponer} className={btnSuave}>
                    Sí, escríbelo de nuevo
                  </button>
                  <button type="button" onClick={() => setConfirmar(false)} className={btnSecundario}>
                    No, déjalo así
                  </button>
                </div>
              }
            >
              Voy a escribir de nuevo el estilo, el saludo y las indicaciones con los datos de tu hotel.
            </Aviso>
          </div>
        )}
        {aviso && (
          <div className="mb-4">
            <Aviso tono={aviso.tono} onCerrar={() => setAviso(null)}>
              {aviso.texto}
            </Aviso>
          </div>
        )}

        <div role="radiogroup" aria-label="Estilo" className="grid gap-3 sm:grid-cols-3">
          {ESTILOS.map((e) => {
            const sel = estiloActual === e.id;
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => {
                  cambiarBot({ tono: e.tono });
                  setPropioAbierto(false);
                }}
                className={`btn-press flex flex-col gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                  sel ? "border-kora-primary bg-kora-primary/5 ring-1 ring-kora-primary" : "border-panel-border hover:border-kora-primary/40"
                }`}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-bold text-kora-text">
                  {e.titulo}
                  <span
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 rounded-full border-2 ${sel ? "border-kora-primary bg-kora-primary shadow-[inset_0_0_0_2px_white]" : "border-panel-border"}`}
                  />
                </span>
                <span className="rounded-xl rounded-bl-md bg-kora-bg px-3 py-2 text-xs leading-relaxed text-kora-text">
                  <TextoWhatsApp texto={e.ejemplo} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          {!propioAbierto && estiloActual !== "propio" ? (
            <button type="button" onClick={() => setPropioAbierto(true)} className="text-sm font-semibold text-kora-primary hover:underline">
              Prefiero describirlo con mis palabras
            </button>
          ) : (
            <Campo
              label="Descríbelo con tus palabras"
              ayuda="Ej.: «Amable y breve, trata de usted, menciona que somos un hotel familiar». No pongas aquí precios ni políticas: eso se configura en «Lo que sabe»."
              max={2000}
              valor={bot.tono}
            >
              {(p) => (
                <textarea
                  {...p}
                  rows={3}
                  value={bot.tono}
                  onChange={(e) => cambiarBot({ tono: e.target.value.slice(0, 2000) })}
                  className="input-kora"
                />
              )}
            </Campo>
          )}
        </div>
      </Tarjeta>

      <Tarjeta icono={<Smile size={18} />} titulo="Emojis" descripcion="Cuántos usa en sus mensajes.">
        <Chips
          etiqueta="Cantidad de emojis"
          opciones={NIVELES}
          seleccion={[bot.emojis.nivel]}
          onChange={([v]) => cambiarBot({ emojis: { nivel: v } })}
        />
        {bot.emojis.nivel !== "nada" && (
          <div className="mt-4 max-w-sm">
            <Campo label="Sus emojis favoritos" opcional ayuda="Los de tu marca. Ej.: 🌿🦜🌺" max={80} valor={bot.emojis.preferidos}>
              {(p) => (
                <input
                  {...p}
                  value={bot.emojis.preferidos}
                  onChange={(e) => cambiarBot({ emojis: { preferidos: e.target.value.slice(0, 80) } })}
                  className="input-kora"
                />
              )}
            </Campo>
          </div>
        )}
      </Tarjeta>

      <Tarjeta
        icono={<Sparkles size={18} />}
        titulo="Su primer mensaje"
        descripcion="Lo que contesta cuando alguien escribe por primera vez."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Campo label="Saludo" opcional max={600} valor={bot.saludo} ayuda="Corto y amable. Ella lo adapta a lo que pregunte el huésped.">
            {(p) => (
              <textarea
                {...p}
                rows={4}
                value={bot.saludo}
                onChange={(e) => cambiarBot({ saludo: e.target.value.slice(0, 600) })}
                placeholder={`¡Hola! Soy ${nombreBot}, de tu hotel. ¿En qué te ayudo?`}
                className="input-kora"
              />
            )}
          </Campo>
          <div aria-hidden="true">
            <p className="mb-1.5 text-sm font-semibold text-kora-text">Así se ve en WhatsApp</p>
            <div className="rounded-2xl bg-kora-bg p-3">
              <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-panel-surface px-3.5 py-2 text-sm leading-relaxed text-kora-text shadow-sm">
                <TextoWhatsApp texto={bot.saludo.trim() || `¡Hola! Soy ${nombreBot}, de tu hotel. ¿En qué te ayudo?`} />
              </div>
            </div>
          </div>
        </div>
      </Tarjeta>
    </div>
  );
}
