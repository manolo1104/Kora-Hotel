"use client";

// Pasos 1-2 de 6 del onboarding unificado: crear el hotel. Al crearse redirige
// (navegación completa, para que el proxy fije la cookie kora_active_slug) a
// /panel/[slug]/onboarding, donde viven los pasos 3-6 resumables.

import { useState } from "react";
import { Loader2, Plus, Trash2, ArrowRight, ArrowLeft, Lightbulb } from "lucide-react";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-panel-border text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";

interface Cuarto {
  nombre: string;
  precio: string;
  maxGuests: string;
}

const card = "bg-panel-surface rounded-2xl p-6 sm:p-7 border border-panel-border-soft shadow-sm";
const TOTAL_PASOS = 6;

export function OnboardingClient() {
  const [paso, setPaso] = useState(0); // 0 = tu hotel · 1 = habitaciones

  // Paso 1 — el hotel
  const [nombre, setNombre] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [descripcion, setDescripcion] = useState("");

  // Paso 2 — habitaciones
  const [cuartos, setCuartos] = useState<Cuarto[]>([
    { nombre: "", precio: "", maxGuests: "2" },
  ]);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  // Mismo criterio que `toNum` del servidor (app/api/panel/crear-hotel/route.ts):
  // conservar el punto decimal. Con /[^0-9]/ "1,500.50" se convertía en 150050,
  // así que el hotelero publicaba su cabaña a $150,050 la noche sin enterarse.
  const aNumero = (v: string) => parseFloat(v.replace(/[^0-9.]/g, "")) || 0;

  const cuartosValidos = cuartos.filter((c) => c.nombre.trim() && aNumero(c.precio) > 0);
  const puedePaso1 = nombre.trim().length > 1;
  const puedePaso2 = cuartosValidos.length > 0;

  function addCuarto() {
    setCuartos((c) => [...c, { nombre: "", precio: "", maxGuests: "2" }]);
  }
  function updateCuarto(i: number, campo: keyof Cuarto, valor: string) {
    setCuartos((c) => c.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
  }
  function removeCuarto(i: number) {
    setCuartos((c) => (c.length <= 1 ? c : c.filter((_, idx) => idx !== i)));
  }

  async function crear() {
    setError("");
    if (!puedePaso1) {
      setError("Ponle un nombre a tu hotel.");
      setPaso(0);
      return;
    }
    if (!puedePaso2) {
      setError("Agrega al menos una habitación con su precio.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/panel/crear-hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          ubicacion: ubicacion.trim(),
          whatsapp: whatsapp.trim(),
          descripcion: descripcion.trim(),
          habitaciones: cuartosValidos.map((c) => ({
            nombre: c.nombre.trim(),
            precio: aNumero(c.precio),
            maxGuests: Number(c.maxGuests.replace(/[^0-9]/g, "")) || 2,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.slug) {
        // Navegación COMPLETA (no router.push): el proxy fija la cookie
        // kora_active_slug al pasar por /panel/[slug], y el paso de cobros
        // (Stripe Connect) la necesita. Se mantiene `enviando` para no
        // rehabilitar el botón mientras el navegador cambia de página.
        window.location.assign(`/panel/${data.slug}/onboarding?nuevo=1`);
        return;
      }
      setError(data.error || "No se pudo crear tu hotel. Inténtalo de nuevo.");
      setEnviando(false);
    } catch {
      setError("No se pudo conectar. Revisa tu internet e inténtalo de nuevo.");
      setEnviando(false);
    }
  }

  // ─── Pasos 1 y 2 de 6: crear el hotel ──────────────────────────────────────
  const pasos = [
    {
      titulo: "Tu hotel",
      desc: "Lo básico para tu página.",
      guia: "Escribe los datos de tu hotel como se los dirías a un huésped. No te preocupes por que quede perfecto: todo lo puedes editar después.",
    },
    {
      titulo: "Habitaciones y tarifas",
      desc: "Lo que ofreces y su precio.",
      guia: "Agrega cada tipo de habitación con su precio por noche. Con una basta para empezar; luego agregas fotos, descripciones y más tarifas.",
    },
  ];

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
          Crea tu hotel
        </h1>
        <p className="mt-1.5 text-sm text-kora-muted">
          Con 2 pasos queda tu página; el resto (fotos, cobros, reglas) lo
          configuras a tu ritmo y tu avance se guarda.
        </p>
      </div>

      <div className={card}>
        {/* Progreso (6 pasos en total; aquí van el 1 y el 2) */}
        <div className="flex items-center gap-1.5 mb-5">
          {Array.from({ length: TOTAL_PASOS }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= paso ? "bg-kora-primary" : "bg-panel-border"
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
          Paso {paso + 1} de {TOTAL_PASOS}
        </p>
        <h2 className="mt-1 text-xl font-bold text-kora-text">{pasos[paso].titulo}</h2>
        <p className="mt-1 text-sm text-kora-muted">{pasos[paso].desc}</p>

        {/* Guía del paso: qué hacer y cómo */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-kora-accent/10 border border-kora-accent/30 px-3.5 py-3">
          <Lightbulb size={16} className="text-kora-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs text-kora-text leading-relaxed">{pasos[paso].guia}</p>
        </div>

        <div className="mt-5 space-y-4">
          {/* PASO 1 */}
          {paso === 0 && (
            <>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  Nombre del hotel <span className="text-kora-primary">*</span>
                </label>
                <input
                  className={inputCls}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Hotel Casa del Río"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-kora-muted">
                  Es lo primero que ve el huésped, en grande, en tu página.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  ¿Dónde está?
                </label>
                <input
                  className={inputCls}
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Xilitla, San Luis Potosí"
                />
                <p className="mt-1.5 text-xs text-kora-muted">
                  Ciudad y estado. Más adelante podrás poner el mapa exacto.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  WhatsApp del hotel <span className="font-normal text-kora-muted">(con lada)</span>
                </label>
                <input
                  className={inputCls}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="52 489 123 4567"
                  inputMode="tel"
                />
                <p className="mt-1.5 text-xs text-kora-muted">
                  Aquí llegan las reservas y mensajes de tus huéspedes.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  Describe tu hotel <span className="font-normal text-kora-muted">(2 o 3 líneas)</span>
                </label>
                <textarea
                  className={inputCls}
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="¿Por qué es especial y qué hay cerca?"
                />
                <p className="mt-1.5 text-xs text-kora-muted">
                  ¿No sabes qué poner? Escribe unas ideas y luego, en tu panel, la IA te la redacta.
                </p>
              </div>
            </>
          )}

          {/* PASO 2 */}
          {paso === 1 && (
            <div className="space-y-3">
              {cuartos.map((c, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-panel-border-soft p-4 bg-kora-bg/50 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-kora-muted uppercase tracking-widest">
                      Habitación {i + 1}
                    </p>
                    {cuartos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCuarto(i)}
                        className="btn-press inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={13} /> Quitar
                      </button>
                    )}
                  </div>
                  <input
                    className={inputCls}
                    value={c.nombre}
                    onChange={(e) => updateCuarto(i, "nombre", e.target.value)}
                    placeholder="Nombre (ej. Habitación doble) *"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className={inputCls}
                      value={c.precio}
                      onChange={(e) => updateCuarto(i, "precio", e.target.value)}
                      placeholder="Precio/noche *"
                      inputMode="numeric"
                    />
                    <input
                      className={inputCls}
                      value={c.maxGuests}
                      onChange={(e) => updateCuarto(i, "maxGuests", e.target.value)}
                      placeholder="Capacidad (huéspedes)"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addCuarto}
                className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-panel-border text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
              >
                <Plus size={15} /> Agregar otra habitación
              </button>
              <p className="text-xs text-kora-muted">
                Luego, en tu panel, podrás agregar fotos, descripciones y precios por
                número de personas.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {/* Navegación */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setError("");
              setPaso((p) => Math.max(0, p - 1));
            }}
            disabled={paso === 0 || enviando}
            className="btn-press inline-flex items-center gap-1.5 px-5 py-3 rounded-full border border-panel-border text-kora-text font-semibold text-sm disabled:opacity-40 hover:border-kora-accent transition-colors"
          >
            <ArrowLeft size={15} /> Atrás
          </button>

          {paso === 0 ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setPaso(1);
              }}
              disabled={!puedePaso1}
              className="btn-press btn-fill inline-flex items-center gap-2 px-7 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors disabled:opacity-50"
            >
              Siguiente <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={crear}
              disabled={enviando || !puedePaso2}
              className="btn-press btn-fill inline-flex items-center gap-2 px-7 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors disabled:opacity-60"
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Creando…
                </>
              ) : (
                <>
                  Crear y continuar <ArrowRight size={15} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-center">
        <a href="/panel" className="text-xs text-kora-muted underline hover:text-kora-text">
          Volver a mi panel
        </a>
      </p>
    </div>
  );
}
