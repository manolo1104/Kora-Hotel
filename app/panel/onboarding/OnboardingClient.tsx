"use client";

import { useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  LayoutDashboard,
  Sparkles,
  PartyPopper,
} from "lucide-react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";

interface Cuarto {
  nombre: string;
  precio: string;
  maxGuests: string;
}

const card = "bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm";

export function OnboardingClient() {
  const [paso, setPaso] = useState(0); // 0,1 = formulario · 2 = listo

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
  const [slug, setSlug] = useState("");
  const [copiado, setCopiado] = useState(false);

  const cuartosValidos = cuartos.filter(
    (c) => c.nombre.trim() && Number(c.precio.replace(/[^0-9]/g, "")) > 0
  );
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
            precio: Number(c.precio.replace(/[^0-9]/g, "")),
            maxGuests: Number(c.maxGuests.replace(/[^0-9]/g, "")) || 2,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.slug) {
        setSlug(data.slug);
        setPaso(2);
      } else {
        setError(data.error || "No se pudo crear tu hotel. Inténtalo de nuevo.");
      }
    } catch {
      setError("No se pudo conectar. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  const snippet = `<script src="${SITE}/embed.js" data-hotel="${slug}"></script>`;

  function copiar(texto: string) {
    navigator.clipboard?.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // ─── Paso 3: ¡Listo! ───────────────────────────────────────────────────────
  if (paso === 2 && slug) {
    return (
      <div className={card}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-kora-accent/15 flex items-center justify-center mx-auto mb-4">
            <PartyPopper size={28} className="text-kora-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-kora-text tracking-tight">
            ¡Tu hotel está listo!
          </h1>
          <p className="mt-2 text-sm text-kora-muted leading-relaxed">
            Ya puedes recibir reservas. Tu dirección es{" "}
            <span className="font-semibold text-kora-text break-all">
              {SITE}/h/{slug}
            </span>
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={`/panel/${slug}/reservas`}
            className="btn-press btn-fill inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            <LayoutDashboard size={16} aria-hidden="true" /> Abrir mi panel
          </a>
          <a
            href={`/h/${slug}/reservar`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
          >
            <ExternalLink size={16} aria-hidden="true" /> Ver mi página de reservas
          </a>
        </div>

        {/* Snippet embebible */}
        <div className="mt-6 rounded-2xl border border-gray-100 bg-kora-bg/50 p-5">
          <p className="text-sm font-bold text-kora-text">
            Pon el motor de reservas en tu propia web
          </p>
          <p className="mt-1 text-xs text-kora-muted leading-relaxed">
            Copia esta línea y pégala en tu sitio donde quieras que aparezca el motor.
          </p>
          <div className="mt-3 flex items-start gap-2">
            <code className="flex-1 min-w-0 block rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-[11px] sm:text-xs text-kora-text break-all font-mono">
              {snippet}
            </code>
            <button
              type="button"
              onClick={() => copiar(snippet)}
              className="btn-press flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-kora-primary text-white text-xs font-semibold hover:bg-kora-primary-dark transition-colors"
            >
              {copiado ? <Check size={14} /> : <Copy size={14} />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-kora-muted">
            ¿No tienes web aún? Comparte el enlace directo:{" "}
            <span className="font-semibold break-all">
              {SITE}/h/{slug}/reservar
            </span>
          </p>
        </div>

        {/* CTA opcional: activar plan */}
        <div className="mt-5 flex items-center justify-between gap-4 flex-wrap rounded-2xl border border-kora-primary/15 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <Sparkles size={18} className="text-kora-primary flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-kora-text">
              <span className="font-bold">Activa tu plan</span>{" "}
              <span className="text-kora-muted">
                para WhatsApp con IA, pricing dinámico y más.
              </span>
            </p>
          </div>
          <a
            href="/pago/iniciar"
            className="btn-press inline-flex items-center px-4 py-2 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            Activar mi plan
          </a>
        </div>

        <p className="mt-5 text-center">
          <a href="/panel" className="text-sm font-semibold text-kora-primary underline hover:text-kora-primary-dark">
            Ir a mi panel general
          </a>
        </p>
      </div>
    );
  }

  // ─── Pasos 1 y 2: formulario ───────────────────────────────────────────────
  const pasos = [
    { titulo: "Tu hotel", desc: "Lo básico para tu página." },
    { titulo: "Habitaciones y tarifas", desc: "Lo que ofreces y su precio." },
  ];

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
          Crea tu hotel
        </h1>
        <p className="mt-1.5 text-sm text-kora-muted">
          En 2 pasos tendrás tu página de reservas lista.
        </p>
      </div>

      <div className={card}>
        {/* Progreso */}
        <div className="flex items-center gap-1.5 mb-5">
          {pasos.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= paso ? "bg-kora-primary" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
          Paso {paso + 1} de {pasos.length}
        </p>
        <h2 className="mt-1 text-xl font-bold text-kora-text">{pasos[paso].titulo}</h2>
        <p className="mt-1 text-sm text-kora-muted">{pasos[paso].desc}</p>

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
                  placeholder="Hotel Paraíso Encantado"
                  autoFocus
                />
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
              </div>
            </>
          )}

          {/* PASO 2 */}
          {paso === 1 && (
            <div className="space-y-3">
              {cuartos.map((c, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-100 p-4 bg-kora-bg/50 space-y-3"
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
                className="btn-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
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
            className="btn-press inline-flex items-center gap-1.5 px-5 py-3 rounded-full border border-gray-200 text-kora-text font-semibold text-sm disabled:opacity-40 hover:border-kora-accent transition-colors"
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
                "Crear mi hotel"
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
