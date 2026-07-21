"use client";

// Pasos 3-6 del onboarding unificado (los pasos 1-2 crean el hotel en
// /panel/onboarding). RESUMABLE: cada avance se guarda en extras.onboarding
// con merge (nunca pisa otras claves del jsonb). El paso de cobros usa
// /api/panel/connect, que lee la cookie kora_active_slug (ya fijada al navegar
// aquí) y valida membresía en el servidor.

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  CreditCard,
  ExternalLink,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  PartyPopper,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen } from "@/lib/images-client";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

const card = "bg-white rounded-2xl p-6 sm:p-7 border border-gray-100 shadow-sm";
const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200";
const btnPrimario =
  "btn-press btn-fill inline-flex items-center gap-2 px-7 py-3 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors disabled:opacity-50";
const btnSecundario =
  "btn-press inline-flex items-center gap-1.5 px-5 py-3 rounded-full border border-gray-200 text-kora-text font-semibold text-sm disabled:opacity-40 hover:border-kora-accent transition-colors";

interface Props {
  slug: string;
  hotelId: string;
  userId: string;
  esDueno: boolean;
  nombre: string;
  whatsapp: string;
  fotosIniciales: string[];
  habitacionesOk: boolean;
  publicadoInicial: boolean;
  reglasIniciales: { anticipoPct: number; minNoches: number; pagoEnHotel: boolean };
  ishPctInicial: number;
  pasoGuardado: number; // 3..6
  completado: boolean;
  chargesEnabled: boolean;
  connectStatus: "pendiente" | "verificado" | "requiere_info";
  requirementsDue: number;
}

const PASOS = [
  { n: 3, titulo: "Fotos", desc: "La primera será tu portada." },
  { n: 4, titulo: "Cobros en línea", desc: "El dinero entra directo a tu cuenta." },
  { n: 5, titulo: "Reglas de cobro", desc: "Anticipo, mínimo de noches e impuestos." },
  { n: 6, titulo: "Publicar", desc: "Revisa tu checklist y comparte tu página." },
];
const TOTAL = 6;

export function OnboardingHotelClient(props: Props) {
  const supabase = createClient();

  const clamp = (n: number) => Math.min(6, Math.max(3, n));
  const [paso, setPaso] = useState(clamp(props.pasoGuardado));
  const [finalizado, setFinalizado] = useState(props.completado);

  const [fotos, setFotos] = useState<string[]>(props.fotosIniciales);
  const [subiendo, setSubiendo] = useState(false);

  const [anticipoPct, setAnticipoPct] = useState(props.reglasIniciales.anticipoPct);
  const [minNoches, setMinNoches] = useState(props.reglasIniciales.minNoches);
  const [pagoEnHotel, setPagoEnHotel] = useState(props.reglasIniciales.pagoEnHotel);
  const [ishPct, setIshPct] = useState(props.ishPctInicial);

  const [publicado, setPublicado] = useState(props.publicadoInicial);
  const [conectando, setConectando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);

  // ── Persistencia con MERGE del jsonb extras (nunca pisa otras claves). Las
  // escrituras se ENCOLAN (no se descartan): un clic rápido en "Siguiente" y
  // luego "Guardar y seguir" no puede perder ni fallar en falso. ──────────────
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  function mergeExtras(
    patch: (actuales: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<boolean> {
    const escribir = async (): Promise<boolean> => {
      try {
        const { data } = await supabase
          .from("hoteles")
          .select("extras")
          .eq("id", props.hotelId)
          .maybeSingle();
        const actuales = ((data?.extras ?? {}) as Record<string, unknown>) || {};
        const { error: upErr } = await supabase
          .from("hoteles")
          .update({ extras: patch(actuales) })
          .eq("id", props.hotelId);
        if (upErr) throw upErr;
        return true;
      } catch (e) {
        console.error("mergeExtras error:", e);
        return false;
      }
    };
    const p = cola.current.then(escribir, escribir);
    cola.current = p;
    return p;
  }

  function irAPaso(n: number) {
    setError("");
    const destino = clamp(n);
    setPaso(destino);
    // Best-effort: si falla, el wizard sigue; solo se pierde la reanudación.
    void mergeExtras((ex) => ({
      ...ex,
      onboarding: { ...((ex.onboarding as object) ?? {}), paso: destino },
    }));
  }

  // ── Paso 3: fotos (mismo bucket y ruta que el editor del sitio) ────────────
  async function onSubirFotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    setError("");
    try {
      const nuevas: string[] = [];
      for (const file of Array.from(files)) {
        // Comprimir a WebP ligero antes de subir (igual que el editor del sitio):
        // el motor y la mini-página cargan mucho más rápido.
        const blob = await comprimirImagen(file);
        const esWebp = blob !== file && blob.type === "image/webp";
        const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
        const ext = esWebp ? "webp" : (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
        const rnd = Math.random().toString(36).slice(2, 6);
        const path = `${props.userId}/${Date.now()}-${rnd}-${base}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("fotos")
          .upload(path, blob, { upsert: false, contentType: esWebp ? "image/webp" : file.type || undefined });
        if (upErr) {
          setError("No se pudo subir una foto. Inténtalo de nuevo.");
          continue;
        }
        const { data } = supabase.storage.from("fotos").getPublicUrl(path);
        nuevas.push(data.publicUrl);
      }
      if (nuevas.length > 0) {
        const todas = [...fotos, ...nuevas];
        const { error: dbErr } = await supabase
          .from("hoteles")
          .update({ fotos: todas })
          .eq("id", props.hotelId);
        if (dbErr) {
          // No mentir: si la BD no guardó, la UI no debe mostrar la foto como guardada.
          setError("Las fotos se subieron pero no se pudieron guardar. Recarga e inténtalo de nuevo.");
          return;
        }
        setFotos(todas);
      }
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarFoto(url: string) {
    const previas = fotos;
    const restantes = fotos.filter((u) => u !== url);
    setFotos(restantes);
    const { error: dbErr } = await supabase
      .from("hoteles")
      .update({ fotos: restantes })
      .eq("id", props.hotelId);
    if (dbErr) {
      // Revertir: la foto sigue en la BD, la UI no debe fingir que se quitó.
      setFotos(previas);
      setError("No se pudo quitar la foto. Inténtalo de nuevo.");
    }
  }

  // ── Paso 4: Stripe Connect ─────────────────────────────────────────────────
  async function conectarStripe() {
    setConectando(true);
    setError("");
    try {
      const res = await fetch("/api/panel/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnTo: "onboarding" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url as string;
        return;
      }
      setError(data.error || "No se pudo iniciar la conexión de cobros.");
    } catch {
      setError("No se pudo conectar. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setConectando(false);
    }
  }

  // ── Paso 5: reglas e impuestos (merge a nivel de sub-objeto) ───────────────
  async function guardarReglasYSeguir() {
    setGuardando(true);
    setError("");
    const ok = await mergeExtras((ex) => ({
      ...ex,
      reglas: {
        ...((ex.reglas as object) ?? {}),
        anticipoPct,
        minNoches,
        pagoEnHotel,
      },
      impuestos: { ...((ex.impuestos as object) ?? {}), ishPct },
      onboarding: { ...((ex.onboarding as object) ?? {}), paso: 6 },
    }));
    setGuardando(false);
    if (ok) setPaso(6);
    else setError("No se pudieron guardar las reglas. Inténtalo de nuevo.");
  }

  // ── Paso 6: publicar + terminar ────────────────────────────────────────────
  async function publicarYTerminar() {
    setGuardando(true);
    setError("");
    try {
      const { error: upErr } = await supabase
        .from("hoteles")
        .update({ publicado: true })
        .eq("id", props.hotelId);
      if (upErr) throw upErr;
      setPublicado(true);
      await mergeExtras((ex) => ({
        ...ex,
        onboarding: { paso: 6, completado: true },
      }));
      setFinalizado(true);
    } catch {
      setError("No se pudo publicar. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const urlPagina = `${SITE}/h/${props.slug}`;
  const urlMotor = `${SITE}/h/${props.slug}/reservar`;
  const snippet = `<script src="${SITE}/embed.js" data-hotel="${props.slug}"></script>`;

  function copiar(texto: string) {
    navigator.clipboard?.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  // ── Pantalla final ─────────────────────────────────────────────────────────
  if (finalizado) {
    return (
      <div className={card}>
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-kora-accent/15 flex items-center justify-center mx-auto mb-4">
            <PartyPopper size={28} className="text-kora-primary" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-kora-text tracking-tight">
            ¡{props.nombre} está en línea!
          </h1>
          <p className="mt-2 text-sm text-kora-muted leading-relaxed">
            Tu página de reservas es{" "}
            <a
              href={urlPagina}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-kora-primary underline break-all"
            >
              {urlPagina}
            </a>
          </p>
          {!props.chargesEnabled && (
            <p className="mt-3 inline-flex items-start gap-2 text-left rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 leading-relaxed">
              <TriangleAlert size={15} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Aún no tienes cobros en línea: tus huéspedes reservarán por WhatsApp.
                Actívalos cuando quieras en{" "}
                <a href={`/panel/${props.slug}/pagos`} className="font-semibold underline">
                  Panel → Pagos
                </a>
                .
              </span>
            </p>
          )}
        </div>

        {/* El siguiente paso natural: entrenar a Camila. Antes el onboarding
            terminaba sin mencionarla y el hotelero ni se enteraba de que existe. */}
        <div className="mt-6 rounded-2xl border border-kora-primary/20 bg-kora-primary/5 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kora-primary/10 text-kora-primary">
              <Bot size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-kora-text">
                Siguiente paso: conoce a Camila, tu asistente de WhatsApp
              </p>
              <p className="mt-1 text-xs text-kora-muted leading-relaxed">
                Contesta a tus huéspedes 24/7 con los datos de tu hotel, cotiza con
                disponibilidad real y cierra reservas con link de pago. Entrénala en 5 minutos.
              </p>
              <a
                href={`/panel/${props.slug}/camila`}
                className="btn-press mt-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-kora-primary text-white font-semibold text-xs hover:bg-kora-primary-dark transition-colors"
              >
                Entrenar a Camila <ArrowRight size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={`/panel/${props.slug}/insights`}
            className="btn-press btn-fill inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
          >
            <LayoutDashboard size={16} aria-hidden="true" /> Abrir mi panel
          </a>
          <a
            href={urlMotor}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full border border-gray-200 text-kora-text font-semibold text-sm hover:border-kora-accent transition-colors"
          >
            <ExternalLink size={16} aria-hidden="true" /> Ver mi motor de reservas
          </a>
        </div>

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
        </div>

        <p className="mt-5 text-center">
          <a
            href="/panel"
            className="text-sm font-semibold text-kora-primary underline hover:text-kora-primary-dark"
          >
            Ir a mis hoteles
          </a>
        </p>
      </div>
    );
  }

  // ── Wizard (pasos 3-6) ─────────────────────────────────────────────────────
  const info = PASOS.find((p) => p.n === paso) ?? PASOS[0];

  const checklist = [
    {
      etiqueta: "Datos y habitaciones",
      ok: props.habitacionesOk && props.nombre.trim().length > 1,
      accion: { href: `/panel/${props.slug}/sitio`, texto: "Completar en el editor" },
    },
    {
      etiqueta: "WhatsApp de contacto",
      ok: props.whatsapp.trim().length >= 8,
      accion: { href: `/panel/${props.slug}/sitio`, texto: "Agregar en el editor" },
    },
    {
      etiqueta: "Al menos una foto",
      ok: fotos.length > 0,
      accion: { paso: 3, texto: "Subir fotos" },
    },
    {
      etiqueta: "Cobros en línea (recomendado)",
      ok: props.chargesEnabled,
      accion: { paso: 4, texto: "Conectar cobros" },
    },
  ];

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-kora-text tracking-tight">
          Configura {props.nombre}
        </h1>
        <p className="mt-1.5 text-sm text-kora-muted">
          Puedes salir cuando quieras: tu avance queda guardado.
        </p>
      </div>

      <div className={card}>
        {/* Progreso (6 pasos; 1 y 2 ya se hicieron al crear el hotel) */}
        <div className="flex items-center gap-1.5 mb-5">
          {Array.from({ length: TOTAL }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < paso ? "bg-kora-primary" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <p className="text-[10px] font-bold text-kora-muted uppercase tracking-widest">
          Paso {paso} de {TOTAL}
        </p>
        <h2 className="mt-1 text-xl font-bold text-kora-text">{info.titulo}</h2>
        <p className="mt-1 text-sm text-kora-muted">{info.desc}</p>

        <div className="mt-5 space-y-4">
          {/* PASO 3 — FOTOS */}
          {paso === 3 && (
            <div>
              {fotos.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {fotos.map((url) => (
                    <div key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt="Foto del hotel"
                        className="w-full h-20 object-cover rounded-xl border border-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => quitarFoto(url)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center text-red-600 shadow-sm"
                        aria-label="Quitar foto"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="btn-press inline-flex items-center gap-2 px-5 py-3 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors cursor-pointer">
                {subiendo ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                {subiendo ? "Subiendo…" : "Subir fotos"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onSubirFotos(e.target.files)}
                />
              </label>
              <p className="mt-3 text-xs text-kora-muted">
                Con 3 a 6 buenas fotos basta para empezar. Se guardan al instante.
              </p>
            </div>
          )}

          {/* PASO 4 — COBROS (Stripe Connect) */}
          {paso === 4 && (
            <div className="space-y-4">
              {props.chargesEnabled ? (
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3.5">
                  <ShieldCheck size={18} className="text-emerald-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Cobros activos</p>
                    <p className="mt-0.5 text-xs text-emerald-800 leading-relaxed">
                      Tus huéspedes ya pueden pagar con tarjeta y el dinero entra directo a tu
                      cuenta. Kora no cobra comisión por reserva.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-kora-text leading-relaxed">
                    Conecta tu cuenta con <b>Stripe</b> (el procesador de pagos) para cobrar
                    con tarjeta y OXXO. El dinero de cada reserva entra{" "}
                    <b>directo a tu banco</b> — Kora no toca tu dinero ni cobra comisión.
                  </p>
                  {props.connectStatus === "requiere_info" && (
                    <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 leading-relaxed">
                      <TriangleAlert size={15} className="flex-shrink-0 mt-0.5" />
                      <span>
                        Stripe necesita que completes{" "}
                        {props.requirementsDue > 0
                          ? `${props.requirementsDue} dato(s)`
                          : "algunos datos"}{" "}
                        para activar tus cobros. Continúa donde te quedaste.
                      </span>
                    </div>
                  )}
                  {props.esDueno ? (
                    <button
                      type="button"
                      onClick={conectarStripe}
                      disabled={conectando}
                      className={btnPrimario}
                    >
                      {conectando ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CreditCard size={16} />
                      )}
                      {props.connectStatus === "requiere_info"
                        ? "Continuar con Stripe"
                        : "Conectar mis cobros"}
                    </button>
                  ) : (
                    <p className="rounded-xl bg-kora-bg/60 border border-gray-100 px-4 py-3 text-xs text-kora-muted">
                      Solo el <b>dueño</b> de la cuenta puede conectar los cobros. Pídele que
                      entre a este paso o a Panel → Pagos.
                    </p>
                  )}
                  <p className="text-xs text-kora-muted">
                    Te tomará unos 5 minutos (datos personales, CLABE). Puedes saltarlo y
                    conectar después: mientras tanto, tus huéspedes reservan por WhatsApp.
                  </p>
                </>
              )}
            </div>
          )}

          {/* PASO 5 — REGLAS E IMPUESTOS */}
          {paso === 5 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-kora-text mb-1.5">
                  ¿Cuánto cobras al reservar?
                </label>
                <div className="flex flex-wrap gap-2">
                  {[30, 50, 100].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAnticipoPct(p)}
                      className={`btn-press px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
                        anticipoPct === p
                          ? "border-kora-accent bg-kora-accent/10 text-kora-primary"
                          : "border-gray-200 text-kora-muted hover:border-kora-accent"
                      }`}
                    >
                      {p === 100 ? "Total (100%)" : `${p}% de anticipo`}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-kora-muted">
                  El huésped paga este % al reservar y el resto al llegar.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-kora-text mb-1.5">
                    Mínimo de noches
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={minNoches}
                    onChange={(e) =>
                      setMinNoches(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-kora-text mb-1.5">
                    Impuesto al hospedaje (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={ishPct}
                    onChange={(e) =>
                      setIshPct(Math.max(0, Math.min(10, Number(e.target.value) || 0)))
                    }
                    className={inputCls}
                  />
                  <p className="mt-1.5 text-xs text-kora-muted">
                    El de tu estado (SLP: 3%). Solo transparenta el desglose; tus precios no
                    cambian.
                  </p>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2.5 text-sm font-semibold text-kora-text">
                  <input
                    type="checkbox"
                    checked={pagoEnHotel}
                    onChange={(e) => setPagoEnHotel(e.target.checked)}
                    className="h-4 w-4 accent-kora-primary"
                  />
                  Permitir &quot;pagar al llegar al hotel&quot;
                </label>
                <p className="mt-1.5 text-xs text-kora-muted">
                  El huésped deja su tarjeta como garantía y paga en recepción. Requiere
                  cobros conectados (paso anterior).
                </p>
              </div>

              <p className="text-xs text-kora-muted">
                Tarifa no reembolsable, extras vendibles y más opciones viven en{" "}
                <a
                  href={`/panel/${props.slug}/sitio`}
                  className="font-semibold text-kora-primary underline"
                >
                  Editar sitio → Avanzado
                </a>
                .
              </p>
            </div>
          )}

          {/* PASO 6 — PUBLICAR + CHECKLIST REAL */}
          {paso === 6 && (
            <div className="space-y-4">
              <ul className="space-y-2.5">
                {checklist.map((item) => (
                  <li
                    key={item.etiqueta}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-kora-bg/40 px-4 py-3"
                  >
                    <span className="flex items-center gap-2.5 text-sm text-kora-text">
                      {item.ok ? (
                        <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                      ) : (
                        <Circle size={18} className="text-gray-300 flex-shrink-0" />
                      )}
                      {item.etiqueta}
                    </span>
                    {!item.ok &&
                      ("paso" in item.accion && item.accion.paso ? (
                        <button
                          type="button"
                          onClick={() => irAPaso(item.accion.paso as number)}
                          className="btn-press flex-shrink-0 text-xs font-bold text-kora-primary underline"
                        >
                          {item.accion.texto}
                        </button>
                      ) : (
                        <a
                          href={(item.accion as { href: string }).href}
                          className="btn-press flex-shrink-0 text-xs font-bold text-kora-primary underline"
                        >
                          {item.accion.texto}
                        </a>
                      ))}
                  </li>
                ))}
              </ul>

              {!props.chargesEnabled && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 leading-relaxed">
                  <TriangleAlert size={15} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Puedes publicar sin cobros en línea: tus huéspedes reservarán por
                    WhatsApp y tú cobras a tu manera. Cuando conectes Stripe, el pago con
                    tarjeta se activa solo.
                  </span>
                </div>
              )}

              {publicado && (
                <p className="text-xs text-kora-muted">
                  Tu página ya está publicada; este botón solo confirma y te da tus enlaces.
                </p>
              )}
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
            onClick={() => irAPaso(paso - 1)}
            disabled={paso <= 3 || guardando}
            className={btnSecundario}
          >
            <ArrowLeft size={15} /> Atrás
          </button>

          {paso === 5 ? (
            <button
              type="button"
              onClick={guardarReglasYSeguir}
              disabled={guardando}
              className={btnPrimario}
            >
              {guardando ? <Loader2 size={16} className="animate-spin" /> : null}
              Guardar y seguir <ArrowRight size={15} />
            </button>
          ) : paso === 6 ? (
            <button
              type="button"
              onClick={publicarYTerminar}
              disabled={guardando}
              className={btnPrimario}
            >
              {guardando ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Publicando…
                </>
              ) : publicado ? (
                "Terminar"
              ) : (
                "Publicar mi página"
              )}
            </button>
          ) : (
            <button type="button" onClick={() => irAPaso(paso + 1)} className={btnPrimario}>
              {(paso === 3 && fotos.length === 0) || (paso === 4 && !props.chargesEnabled)
                ? "Saltar por ahora"
                : "Siguiente"}{" "}
              <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-center">
        <a href="/panel" className="text-xs text-kora-muted underline hover:text-kora-text">
          Guardar y salir (retomas después)
        </a>
      </p>
    </div>
  );
}
