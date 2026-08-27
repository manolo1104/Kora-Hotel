"use client";

import { useState } from "react";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { trackSuscripcion } from "@/lib/analytics";

// El formulario de la lista de correo. UN SOLO CAMPO.
//
// Es deliberado, y es la diferencia con LeadCaptureTool (que pide nombre,
// WhatsApp, correo y hotel). Aquel le habla a quien ya decidió que quiere que
// le llamen; éste le habla a un desconocido a media lectura. Cada campo extra
// en ese momento tira la conversión, y el correo es lo único que se necesita
// para mandarle la guía.
//
// Tres pieles, mismo motor:
//   "claro"  → sobre fondo claro (artículos, herramientas, /guia)
//   "oscuro" → sobre el verde del pie de página
//   "popup"  → dentro del modal, con el botón abajo y no al lado

export type PielSuscripcion = "claro" | "oscuro" | "popup";

interface Props {
  /** De dónde entró. Viaja a la BD y a GA4: es cómo se sabe qué superficie capta. */
  origen: string;
  piel?: PielSuscripcion;
  textoBoton?: string;
  /** Nota bajo el campo. `null` la quita (el popup pone la suya). */
  nota?: string | null;
  /** Se llama cuando el alta salió bien (el popup lo usa para cerrarse). */
  alSuscribir?: () => void;
  autoFocus?: boolean;
}

/** Marca local para que el popup no vuelva a aparecerle a quien ya se suscribió. */
export const CLAVE_SUSCRITO = "kora_suscrito";

export function SuscripcionForm({
  origen,
  piel = "claro",
  textoBoton = "Quiero la guía",
  nota = "Gratis. Un correo cada tantos días. Te das de baja en un clic.",
  alSuscribir,
  autoFocus = false,
}: Props) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"idle" | "enviando" | "listo">("idle");
  const [error, setError] = useState("");

  const oscuro = piel === "oscuro";
  const apilado = piel === "popup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const data = new FormData(e.currentTarget);
    // Honeypot: si trae texto es un bot. Fingimos éxito para que no reintente.
    if (data.get("_gotcha")) {
      setEstado("listo");
      return;
    }

    setEstado("enviando");
    try {
      const res = await fetch("/api/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, origen }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "No pudimos registrarte. Inténtalo de nuevo.");
        setEstado("idle");
        return;
      }
      // Se marca ANTES de avisar: si el popup se cierra en el callback, la marca
      // ya quedó y no vuelve a aparecer.
      try {
        localStorage.setItem(CLAVE_SUSCRITO, "1");
      } catch {
        // Modo incógnito o almacenamiento bloqueado: el alta ya se hizo igual.
      }
      trackSuscripcion(origen);
      setEstado("listo");
      alSuscribir?.();
    } catch {
      setError("No pudimos registrarte. Revisa tu conexión e inténtalo de nuevo.");
      setEstado("idle");
    }
  }

  if (estado === "listo") {
    return (
      <div
        className={`flex items-start gap-3 rounded-xl px-4 py-3.5 ${
          oscuro ? "bg-white/10" : "bg-kora-accent/12"
        }`}
        role="status"
      >
        <span
          className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
            oscuro ? "bg-white/20 text-white" : "bg-kora-accent/25 text-kora-primary"
          }`}
        >
          <Check size={14} aria-hidden="true" />
        </span>
        <div>
          <p className={`text-sm font-bold ${oscuro ? "text-white" : "text-kora-text"}`}>
            Listo, ya va en camino.
          </p>
          <p className={`mt-0.5 text-xs leading-relaxed ${oscuro ? "text-white/60" : "text-kora-muted"}`}>
            Revisa tu correo en un par de minutos. Si no lo ves, busca en
            promociones o spam y márcalo como “no es spam”.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {/* Honeypot anti-spam */}
      <input
        type="text"
        name="_gotcha"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <div className={apilado ? "space-y-2.5" : "flex flex-col gap-2.5 sm:flex-row"}>
        <label htmlFor={`sus-${origen}`} className="sr-only">
          Tu correo
        </label>
        <input
          id={`sus-${origen}`}
          name="email"
          type="email"
          required
          autoFocus={autoFocus}
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@hotel.com"
          aria-invalid={Boolean(error)}
          className={`min-w-0 flex-1 rounded-xl px-4 py-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2 ${
            oscuro
              ? "border border-white/15 bg-white/10 text-white placeholder:text-white/40 focus:ring-kora-accent"
              : "border border-gray-200 bg-white text-kora-text placeholder:text-kora-muted focus:border-transparent focus:ring-kora-accent"
          }`}
        />
        <button
          type="submit"
          disabled={estado === "enviando"}
          className={`btn-press btn-fill inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
            apilado ? "w-full" : ""
          } ${
            oscuro
              ? "bg-kora-accent text-kora-primary hover:bg-kora-accent-dark"
              : "bg-kora-primary text-white hover:bg-kora-primary/90"
          }`}
        >
          {estado === "enviando" ? (
            <>
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              Enviando…
            </>
          ) : (
            <>
              {textoBoton}
              <ArrowRight size={15} aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      {nota && (
        <p
          className={`mt-2.5 text-xs leading-relaxed ${
            oscuro ? "text-white/40" : "text-kora-muted"
          }`}
        >
          {nota}
        </p>
      )}
    </form>
  );
}
