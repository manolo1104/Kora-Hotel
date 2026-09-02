"use client";

import { useState } from "react";
import { Firma } from "./Firma";

interface Props {
  slug: string;
  r: string;
  hotelNombre: string;
  clienteName: string;
  confirmacion: string;
  checkin: string;
  checkout: string;
  habitaciones: string;
  huespedes: number;
  yaRegistrado: boolean;
  origen: "correo" | "qr_reserva";
}

interface Acompanante {
  nombre: string;
  edad?: number;
}

function fecha(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function PreCheckinForm(p: Props) {
  // Si ya se registró, se arranca en la pantalla de confirmación. NO se le
  // vuelven a enseñar sus datos: quien tenga el enlace podría leerlos. Puede
  // rehacerlo, pero desde cero.
  const [listo, setListo] = useState(p.yaRegistrado);
  const [rehaciendo, setRehaciendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  const [nombreCompleto, setNombreCompleto] = useState(p.clienteName);
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [ciudadOrigen, setCiudadOrigen] = useState("");
  const [pais, setPais] = useState("México");
  const [documentoTipo, setDocumentoTipo] = useState("INE");
  const [documentoRef, setDocumentoRef] = useState("");
  const [horaEstimada, setHoraEstimada] = useState("");
  const [placas, setPlacas] = useState("");
  const [firma, setFirma] = useState("");
  const [aceptaReglamento, setAceptaReglamento] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [acompanantes, setAcompanantes] = useState<Acompanante[]>([]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError("");
    if (!aceptaPrivacidad) {
      setError("Hace falta aceptar el aviso de privacidad para registrarte.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch(`/api/h/${encodeURIComponent(p.slug)}/pre-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          r: p.r,
          nombreCompleto,
          telefono,
          email,
          domicilio,
          ciudadOrigen,
          pais,
          documentoTipo,
          documentoRef,
          acompanantes: acompanantes.filter((a) => a.nombre.trim()),
          horaEstimada,
          placas,
          firma,
          aceptaReglamento,
          aceptaPrivacidad,
          origen: p.origen,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setError(d.error || "No pudimos guardar tu registro. Inténtalo de nuevo.");
        return;
      }
      setListo(true);
      setRehaciendo(false);
    } catch {
      setError("No hay conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (listo && !rehaciendo) {
    return (
      <div className="text-center">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
          aria-hidden
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Ya recibimos tu registro</h1>
        <p className="mt-2 text-sm text-gray-600">
          Al llegar a {p.hotelNombre} solo tienes que dar tu nombre y recoger la llave.
        </p>
        {p.confirmacion && (
          <p className="mt-4 text-xs uppercase tracking-widest text-gray-400">{p.confirmacion}</p>
        )}
        <button
          type="button"
          onClick={() => setRehaciendo(true)}
          className="mt-6 text-xs text-gray-500 underline"
        >
          Necesito corregir algo
        </button>
      </div>
    );
  }

  const campo = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400";
  const etiqueta = "mb-1 block text-xs font-medium text-gray-600";

  return (
    <form onSubmit={enviar} className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--brand)" }}>
          {p.hotelNombre}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900">Tu registro de llegada</h1>
        <p className="mt-1 text-sm text-gray-600">
          Llénalo ahora y en recepción solo recoges la llave.
        </p>
      </header>

      {/* Lo que el hotel ya sabe. Sirve para que el huésped confirme que el
          enlace es el suyo antes de teclear nada. */}
      <div className="rounded-2xl bg-gray-50 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-gray-500">Llegada</span>
          <span className="font-medium text-gray-900">{fecha(p.checkin)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span className="text-gray-500">Salida</span>
          <span className="font-medium text-gray-900">{fecha(p.checkout)}</span>
        </div>
        {p.habitaciones && (
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-gray-500">Habitación</span>
            <span className="font-medium text-gray-900">{p.habitaciones}</span>
          </div>
        )}
      </div>

      <div>
        <label className={etiqueta} htmlFor="pc-nombre">Nombre completo *</label>
        <input id="pc-nombre" className={campo} value={nombreCompleto} required maxLength={160}
          onChange={(e) => setNombreCompleto(e.target.value)} autoComplete="name" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiqueta} htmlFor="pc-tel">Teléfono</label>
          <input id="pc-tel" className={campo} value={telefono} maxLength={40} inputMode="tel"
            onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />
        </div>
        <div>
          <label className={etiqueta} htmlFor="pc-email">Correo</label>
          <input id="pc-email" className={campo} value={email} maxLength={160} inputMode="email"
            onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
      </div>

      <div>
        <label className={etiqueta} htmlFor="pc-dom">Domicilio</label>
        <input id="pc-dom" className={campo} value={domicilio} maxLength={300}
          onChange={(e) => setDomicilio(e.target.value)} autoComplete="street-address" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiqueta} htmlFor="pc-ciudad">Ciudad de origen</label>
          <input id="pc-ciudad" className={campo} value={ciudadOrigen} maxLength={120}
            onChange={(e) => setCiudadOrigen(e.target.value)} />
        </div>
        <div>
          <label className={etiqueta} htmlFor="pc-pais">País</label>
          <input id="pc-pais" className={campo} value={pais} maxLength={80}
            onChange={(e) => setPais(e.target.value)} autoComplete="country-name" />
        </div>
      </div>

      {/* Identificación: SÓLO el tipo y los últimos dígitos. No se sube ninguna
          foto — así el hotel no custodia imágenes de INE ni pasaportes. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiqueta} htmlFor="pc-doc">Identificación</label>
          <select id="pc-doc" className={campo} value={documentoTipo}
            onChange={(e) => setDocumentoTipo(e.target.value)}>
            <option>INE</option><option>Pasaporte</option><option>Licencia</option><option>Otro</option>
          </select>
        </div>
        <div>
          <label className={etiqueta} htmlFor="pc-docref">Últimos 4 dígitos</label>
          <input id="pc-docref" className={campo} value={documentoRef} maxLength={8} inputMode="numeric"
            onChange={(e) => setDocumentoRef(e.target.value)} placeholder="1234" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={etiqueta} htmlFor="pc-hora">¿A qué hora llegas?</label>
          <input id="pc-hora" type="time" className={campo} value={horaEstimada}
            onChange={(e) => setHoraEstimada(e.target.value)} />
        </div>
        <div>
          <label className={etiqueta} htmlFor="pc-placas">Placas del auto</label>
          <input id="pc-placas" className={campo} value={placas} maxLength={20}
            onChange={(e) => setPlacas(e.target.value)} />
        </div>
      </div>

      <div>
        <span className={etiqueta}>¿Quién más viene contigo?</span>
        {acompanantes.map((a, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <input className={campo} value={a.nombre} maxLength={120} placeholder="Nombre"
              onChange={(e) =>
                setAcompanantes((prev) => prev.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))
              } />
            <button type="button" aria-label="Quitar acompañante"
              className="shrink-0 rounded-xl border border-gray-200 px-3 text-sm text-gray-500"
              onClick={() => setAcompanantes((prev) => prev.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        {acompanantes.length < 20 && (
          <button type="button" className="text-xs underline" style={{ color: "var(--brand)" }}
            onClick={() => setAcompanantes((prev) => [...prev, { nombre: "" }])}>
            + Agregar acompañante
          </button>
        )}
      </div>

      <div>
        <span className={etiqueta}>Firma</span>
        <Firma onChange={setFirma} />
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input type="checkbox" className="mt-0.5" checked={aceptaReglamento}
          onChange={(e) => setAceptaReglamento(e.target.checked)} />
        <span>Acepto el reglamento interno del hotel.</span>
      </label>

      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input type="checkbox" className="mt-0.5" checked={aceptaPrivacidad} required
          onChange={(e) => setAceptaPrivacidad(e.target.checked)} />
        <span>
          Acepto que {p.hotelNombre} use estos datos para mi registro de hospedaje, según su{" "}
          <a href="/privacidad" target="_blank" rel="noopener" className="underline">aviso de privacidad</a>. *
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button type="submit" disabled={enviando}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-60"
        style={{ background: "var(--brand)", color: "var(--brand-ink)" }}>
        {enviando ? "Enviando…" : "Enviar mi registro"}
      </button>
    </form>
  );
}
