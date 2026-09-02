"use client";

import { useState } from "react";

// El QR FIJO del mostrador cae aquí: no trae reserva en el enlace, así que el
// huésped se identifica con su folio y su apellido. Es la segunda de las dos
// puertas que pidió el hotelero — la del huésped que llega sin haber hecho el
// pre check-in.

export function BuscarReserva({ slug, hotelNombre }: { slug: string; hotelNombre: string }) {
  const [folio, setFolio] = useState("");
  const [apellido, setApellido] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (buscando) return;
    setError("");
    setBuscando(true);
    try {
      const res = await fetch(`/api/h/${encodeURIComponent(slug)}/pre-checkin/buscar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folio, apellido }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setError(d.error || "No encontramos esa reserva.");
        return;
      }
      // `qr=1` marca el origen para saber después qué canal usa la gente.
      window.location.href = `/h/${encodeURIComponent(slug)}/pre-checkin?r=${d.r}&qr=1`;
    } catch {
      setError("No hay conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setBuscando(false);
    }
  }

  const campo = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400";

  return (
    <form onSubmit={buscar} className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--brand)" }}>
          {hotelNombre}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Regístrate desde tu celular</h1>
        <p className="mt-1 text-sm text-gray-600">
          Busca tu reserva y llena tu registro aquí mismo, sin esperar en el mostrador.
        </p>
      </header>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pc-folio">
          Folio de tu reserva
        </label>
        <input id="pc-folio" className={`${campo} uppercase`} value={folio} required
          maxLength={40} placeholder="KO-2026-XXXX" autoComplete="off"
          onChange={(e) => setFolio(e.target.value)} />
        <p className="mt-1 text-xs text-gray-400">Viene en el correo de confirmación.</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pc-apellido">
          Tu apellido
        </label>
        <input id="pc-apellido" className={campo} value={apellido} required maxLength={80}
          autoComplete="family-name" onChange={(e) => setApellido(e.target.value)} />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button type="submit" disabled={buscando}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
        style={{ background: "var(--brand)", color: "var(--brand-ink)" }}>
        {buscando ? "Buscando…" : "Buscar mi reserva"}
      </button>
    </form>
  );
}
