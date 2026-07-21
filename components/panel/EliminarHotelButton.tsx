"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Trash2, X, AlertTriangle, Loader2 } from "lucide-react";

// Botón destructivo (solo dueño) que abre un modal de confirmación: exige
// escribir el nombre del hotel + la contraseña de la cuenta antes de borrar.
// El modal se monta con un PORTAL en <body>: la tarjeta del panel vive dentro
// de <Reveal> (transform de framer-motion) y un transform en el ancestro
// convierte `position: fixed` en relativo a la tarjeta → modal recortado y
// sin botones visibles (bug reportado por Manolo el 21 jul).
export function EliminarHotelButton({
  slug,
  nombre,
}: {
  slug: string;
  nombre: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombreOk = confirmName.trim() === nombre.trim();
  const canDelete = nombreOk && password.length > 0 && !loading;

  function cerrar() {
    if (loading) return;
    setOpen(false);
    setConfirmName("");
    setPassword("");
    setError(null);
  }

  async function eliminar() {
    if (!canDelete) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/panel/eliminar-hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, password }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(data.error ?? "No pudimos eliminar el hotel.");
        setLoading(false);
        return;
      }
      // Éxito: refrescar el panel (ya sin este hotel). No reseteamos loading;
      // la tarjeta se desmonta al re-renderizar el server component.
      router.refresh();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-press inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
      >
        <Trash2 size={14} aria-hidden="true" /> Eliminar hotel
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={cerrar}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-kora-text">Eliminar “{nombre}”</h3>
                <p className="mt-1 text-sm text-kora-muted leading-relaxed">
                  Esta acción es <strong className="text-kora-text">permanente</strong>. Se
                  borrarán el sitio, las reservas, los huéspedes y todos los datos de este
                  hotel. No se puede deshacer.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrar}
                className="ml-auto flex-shrink-0 text-kora-muted hover:text-kora-text"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-kora-text">
                  Escribe el nombre del hotel para confirmar
                </span>
                <input
                  type="text"
                  name="confirmar-nombre-hotel"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={nombre}
                  autoComplete="off"
                  disabled={loading}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-kora-accent focus:outline-none disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-kora-text">
                  Tu contraseña de la cuenta
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  // "new-password" a propósito: evita que Chrome autollene el
                  // par usuario+contraseña (metía el email en el campo del
                  // nombre del hotel y bloqueaba la confirmación).
                  autoComplete="new-password"
                  disabled={loading}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-kora-accent focus:outline-none disabled:opacity-60"
                />
              </label>
            </div>

            {error && <p className="mt-3 text-xs text-red-600 leading-relaxed">{error}</p>}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cerrar}
                disabled={loading}
                className="btn-press px-4 py-2 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={eliminar}
                disabled={!canDelete}
                className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
