"use client";

import { useState } from "react";
import { Lock, Unlock, Loader2, AlertTriangle } from "lucide-react";

// Bloqueo / desbloqueo de cuentas de hotel, solo para el fundador (vive dentro
// del CRM, detrás de su contraseña). Bloquear NO borra nada: apaga el panel, la
// página de reservas y el bot, y deja el mensaje que el hotelero ve al entrar.

export interface HotelAdminRow {
  slug: string;
  nombre: string;
  publicado: boolean;
  demo: boolean;
  bloqueado: boolean;
  mensaje: string | null;
  fecha: string | null;
}

export function HotelesAdmin({ initial }: { initial: HotelAdminRow[] }) {
  const [hoteles, setHoteles] = useState(initial);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function aplicar(slug: string, bloquear: boolean, texto?: string) {
    setCargando(slug);
    setError(null);
    try {
      const res = await fetch("/api/crm/hoteles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, bloquear, mensaje: texto ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo guardar el cambio.");
        return;
      }
      setHoteles((prev) =>
        prev.map((h) =>
          h.slug === slug
            ? {
                ...h,
                bloqueado: bloquear,
                mensaje: bloquear ? (texto ?? "") : null,
                fecha: bloquear ? new Date().toISOString() : null,
              }
            : h,
        ),
      );
      setAbierto(null);
      setMensaje("");
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-kora-text">Cuentas de hotel</h1>
      <p className="mt-1.5 text-sm text-kora-muted">
        Bloquear apaga el panel, la página de reservas y el bot de WhatsApp. No
        borra nada: se puede deshacer en un clic.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <ul className="mt-7 space-y-3">
        {hoteles.map((h) => (
          <li
            key={h.slug}
            className={`rounded-2xl border p-5 ${
              h.bloqueado ? "border-red-200 bg-red-50/40" : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-kora-text">
                  {h.nombre}
                  {h.demo && (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                      demo
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-kora-muted">/h/{h.slug}</p>
                {h.bloqueado && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-red-800">
                    <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>
                      Bloqueado
                      {h.fecha ? ` el ${new Date(h.fecha).toLocaleDateString("es-MX")}` : ""} —
                      mensaje: <em>&ldquo;{h.mensaje}&rdquo;</em>
                    </span>
                  </p>
                )}
              </div>

              {h.bloqueado ? (
                <button
                  type="button"
                  onClick={() => aplicar(h.slug, false)}
                  disabled={cargando === h.slug}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-kora-text hover:bg-gray-50 disabled:opacity-50"
                >
                  {cargando === h.slug ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Unlock size={13} aria-hidden="true" />
                  )}
                  Desbloquear
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAbierto(abierto === h.slug ? null : h.slug);
                    setMensaje("");
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
                >
                  <Lock size={13} aria-hidden="true" />
                  Bloquear
                </button>
              )}
            </div>

            {abierto === h.slug && !h.bloqueado && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <label
                  htmlFor={`msg-${h.slug}`}
                  className="block text-xs font-semibold text-kora-text"
                >
                  Mensaje que verá al entrar
                </label>
                <textarea
                  id={`msg-${h.slug}`}
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Escribe aquí lo que quieres que lea…"
                  className="mt-2 w-full resize-none rounded-xl border border-gray-200 p-3 text-sm text-kora-text outline-none focus:border-kora-primary"
                />
                <p className="mt-1.5 text-[11px] leading-relaxed text-kora-muted">
                  Lo va a ver cada vez que entre, y es fácil de capturar en
                  pantalla y compartir. Escríbelo pensando en que se puede
                  volver público.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => aplicar(h.slug, true, mensaje.trim())}
                    disabled={!mensaje.trim() || cargando === h.slug}
                    className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    {cargando === h.slug && (
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    )}
                    Confirmar bloqueo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbierto(null)}
                    className="rounded-full border border-gray-300 px-4 py-2 text-xs font-bold text-kora-muted hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {hoteles.length === 0 && (
        <p className="mt-8 text-center text-sm text-kora-muted">No hay hoteles todavía.</p>
      )}
    </div>
  );
}
