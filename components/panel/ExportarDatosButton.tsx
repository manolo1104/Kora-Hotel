"use client";

import { useState } from "react";
import { Download, Loader2, AlertTriangle } from "lucide-react";

// Descarga TODO el hotel en un Excel: reservas, huéspedes y cotizaciones, una
// hoja cada uno. Solo dueño (lo comprueba la ruta, no este botón).
//
// Por qué no es un simple <a href> y sí un fetch + blob: si la ruta falla, un
// enlace normal saca al hotelero de su panel y lo deja mirando un JSON de error
// en una pantalla en blanco. Con esto se queda donde está y lee, en su idioma,
// qué pasó y qué hacer.
export function ExportarDatosButton({ slug }: { slug: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    if (cargando) return;
    setCargando(true);
    setError(null);
    let url: string | null = null;
    try {
      const r = await fetch(`/api/panel/${encodeURIComponent(slug)}/exportar`);
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No pudimos armar tu archivo.");
        return;
      }
      const blob = await r.blob();

      // El nombre lo pone el servidor en `content-disposition`; si un proxy lo
      // quita, el archivo se llamaría "descarga" y nadie sabría de qué hotel es.
      const cd = r.headers.get("content-disposition") ?? "";
      const nombre =
        /filename="([^"]+)"/.exec(cd)?.[1] ??
        `kora-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;

      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      // Revocar el blob libera la memoria del navegador. Va con retraso porque
      // revocarlo en el mismo tick cancela la descarga que acaba de arrancar.
      const creada = url;
      if (creada) setTimeout(() => URL.revokeObjectURL(creada), 60_000);
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={descargar}
        disabled={cargando}
        className="btn-press inline-flex items-center gap-2 rounded-xl border border-panel-border px-3 py-2 text-xs font-semibold text-kora-text transition-colors hover:border-kora-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cargando ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : (
          <Download size={14} aria-hidden="true" />
        )}
        {cargando ? "Armando tu archivo…" : "Descargar mis datos (Excel)"}
      </button>
      {error && (
        <p className="inline-flex items-start gap-1.5 text-xs text-red-600" role="alert">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
