"use client";

import { useState } from "react";
import { MessageCircle, CalendarDays, Users } from "lucide-react";

function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

function fmtFecha(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function ReservaForm({
  hotelNombre,
  whatsapp,
  habitaciones,
}: {
  hotelNombre: string;
  whatsapp: string;
  habitaciones: string[];
}) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [llegada, setLlegada] = useState("");
  const [salida, setSalida] = useState("");
  const [huespedes, setHuespedes] = useState("2");
  const [habitacion, setHabitacion] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");

  function enviar() {
    setError("");
    if (llegada && salida && salida <= llegada) {
      setError("La fecha de salida debe ser posterior a la de llegada.");
      return;
    }
    const lineas = [
      `Hola, vi su página y quiero reservar en ${hotelNombre}.`,
      llegada ? `Llegada: ${fmtFecha(llegada)}` : "",
      salida ? `Salida: ${fmtFecha(salida)}` : "",
      huespedes ? `Huéspedes: ${huespedes}` : "",
      habitacion ? `Habitación: ${habitacion}` : "",
      nota.trim() ? `Nota: ${nota.trim()}` : "",
    ].filter(Boolean);
    const url = `https://wa.me/${soloDigitos(whatsapp)}?text=${encodeURIComponent(
      lineas.join("\n")
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const fieldCls =
    "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-kora-text text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent transition-all";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <p className="font-bold text-kora-text mb-3 inline-flex items-center gap-2">
        <CalendarDays size={17} style={{ color: "var(--brand)" }} aria-hidden="true" />
        Solicita tu reserva
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-kora-muted mb-1">Llegada</label>
          <input
            type="date"
            min={hoy}
            value={llegada}
            onChange={(e) => setLlegada(e.target.value)}
            className={fieldCls}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-kora-muted mb-1">Salida</label>
          <input
            type="date"
            min={llegada || hoy}
            value={salida}
            onChange={(e) => setSalida(e.target.value)}
            className={fieldCls}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-kora-muted mb-1">
            <Users size={12} className="inline mr-1" aria-hidden="true" />
            Huéspedes
          </label>
          <input
            type="number"
            min={1}
            value={huespedes}
            onChange={(e) => setHuespedes(e.target.value)}
            className={fieldCls}
            inputMode="numeric"
          />
        </div>
        {habitaciones.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-kora-muted mb-1">Habitación</label>
            <select
              value={habitacion}
              onChange={(e) => setHabitacion(e.target.value)}
              className={fieldCls}
            >
              <option value="">Cualquiera</option>
              {habitaciones.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-3">
        <label className="block text-xs font-semibold text-kora-muted mb-1">Nota (opcional)</label>
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej. llegamos tarde, viajamos con un bebé…"
          className={fieldCls}
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={enviar}
        className="btn-press btn-fill mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm transition-colors"
        style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
      >
        <MessageCircle size={17} aria-hidden="true" />
        Solicitar por WhatsApp
      </button>
      <p className="mt-2 text-center text-[11px] text-kora-muted">
        Te abrimos WhatsApp con tu solicitud lista para enviar.
      </p>
    </div>
  );
}
