"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

// El interruptor del correo de registro previo.
//
// APAGADO POR DEFECTO a propósito: encenderlo para toda la flota significaría
// que a los huéspedes de otros hoteles les empieza a llegar un correo que su
// hotelero no pidió ni sabe que existe. Lo enciende quien lo quiere.
//
// Escribe por su propia ruta y no por el "Guardar" del editor porque
// `hoteles.config` está revocado a la llave del navegador (ver
// sql/kora-e5-aislamiento.sql): sólo el servidor puede tocarlo.
export function RegistroPrevioSwitch() {
  const [activo, setActivo] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Se lee del servidor: `hoteles.config` está revocado a la llave del navegador
  // (sql/kora-e5-aislamiento.sql), así que el panel no lo tiene a mano.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/pre-checkin?ajuste=1");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        if (vivo) setActivo(Boolean(d.activo));
      } catch (e) {
        // NO se traga. Si no se sabe el estado, pintar el interruptor apagado
        // sería MENTIR: el hotelero leería "el correo no sale" cuando podría
        // estar saliendo. Se dice que no se pudo leer y se deja bloqueado.
        console.error("[RegistroPrevioSwitch] no se pudo leer el ajuste:", e);
        if (vivo) { setError("No pudimos leer si está encendido. Recarga la página."); setIlegible(true); }
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [ilegible, setIlegible] = useState(false);

  async function cambiar(siguiente: boolean) {
    if (guardando) return;
    setGuardando(true);
    setError("");
    // Optimista: el interruptor responde al instante y se revierte si falla.
    setActivo(siguiente);
    try {
      const res = await fetch("/api/admin/pre-checkin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: siguiente }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setActivo(!siguiente);
        setError(d.error || "No se pudo guardar.");
      }
    } catch {
      setActivo(!siguiente);
      setError("No hay conexión. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={activo}
          disabled={guardando || cargando || ilegible}
          onChange={(e) => cambiar(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-kora-accent"
        />
        <span className="text-sm text-kora-text">
          <strong>Mandar el correo de registro dos días antes de cada llegada.</strong>
          <span className="mt-1 block text-kora-muted">
            El huésped llena sus datos desde su celular y en recepción sólo recoge la
            llave. A quien ya se registró no se le insiste.
            {guardando && <Loader2 size={12} className="ml-2 inline animate-spin" />}
          </span>
        </span>
      </label>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
