"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView, useReducedMotion } from "motion/react";
import {
  MessageCircle,
  LayoutGrid,
  Calendar,
  BarChart3,
  Users,
  Sparkles,
  Check,
  Lock,
  ShieldCheck,
} from "lucide-react";

const EASE = [0.23, 1, 0.32, 1] as const;

/* -------------------------------------------------------------------------- */
/*  Marco compartido: "ventana de app" (mismo lenguaje visual en todo el sitio) */
/* -------------------------------------------------------------------------- */

export function WindowFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-2xl shadow-kora-primary/20 border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-kora-bg/60">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        <div className="ml-3 flex items-center gap-1.5 text-[11px] text-kora-muted">
          <span className="font-bold text-kora-primary">Kora</span>
          <span className="hidden sm:inline">· {title}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard dinámico — el panel del hotel, con reservas que entran en vivo   */
/* -------------------------------------------------------------------------- */

type Reserva = { ini: string; nombre: string; hab: string; canal: "WhatsApp" | "Directa" };

const POOL: Reserva[] = [
  { ini: "MR", nombre: "María R.", hab: "Suite Jardín", canal: "WhatsApp" },
  { ini: "JL", nombre: "Jorge L.", hab: "Hab. 204", canal: "Directa" },
  { ini: "AC", nombre: "Ana C.", hab: "Suite Río", canal: "WhatsApp" },
  { ini: "RP", nombre: "Rodrigo P.", hab: "Hab. 110", canal: "WhatsApp" },
  { ini: "LG", nombre: "Lucía G.", hab: "Suite Mirador", canal: "Directa" },
  { ini: "DT", nombre: "Diego T.", hab: "Hab. 305", canal: "WhatsApp" },
];

const week = [
  { d: "L", h: 52 },
  { d: "M", h: 64 },
  { d: "M", h: 48 },
  { d: "J", h: 78 },
  { d: "V", h: 92 },
  { d: "S", h: 100 },
  { d: "D", h: 70 },
];

export function DashboardMockup() {
  const navItems = [LayoutGrid, Calendar, BarChart3, MessageCircle, Users];

  const [feed, setFeed] = useState<Reserva[]>(POOL.slice(0, 3));
  const [reservasHoy, setReservasHoy] = useState(7);
  const [ocupacion, setOcupacion] = useState(86);
  const idx = useRef(3);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const id = setInterval(() => {
      const next = POOL[idx.current % POOL.length];
      idx.current += 1;
      setFeed((prev) => [next, ...prev].slice(0, 3));
      setReservasHoy((n) => n + 1);
      setOcupacion((o) => Math.min(94, Math.max(82, o + (Math.random() > 0.5 ? 1 : -1))));
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { label: "Ocupación", value: `${ocupacion}%` },
    { label: "RevPAR", value: "$1,240" },
    { label: "Reservas hoy", value: `${reservasHoy}` },
  ];

  return (
    <div className="relative select-none">
      <WindowFrame title="Panel de tu hotel">
        <div className="flex">
          {/* Sidebar */}
          <div className="hidden sm:flex flex-col gap-1 w-12 py-4 items-center bg-kora-bg/40 border-r border-gray-100">
            {navItems.map((Icon, i) => (
              <div
                key={i}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  i === 0 ? "bg-kora-primary text-white" : "text-kora-muted"
                }`}
              >
                <Icon size={15} />
              </div>
            ))}
          </div>

          {/* Contenido */}
          <div className="flex-1 p-4 sm:p-5 space-y-4">
            {/* Encabezado */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-kora-muted">Hoy · martes · datos de ejemplo</p>
                <p className="text-sm font-bold text-kora-text">Resumen del hotel</p>
              </div>
              <div className="inline-flex items-center gap-1.5 bg-kora-accent/15 text-kora-primary text-[10px] font-semibold px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-kora-accent animate-pulse" />
                Demo
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2.5">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-gray-100 bg-kora-bg/40 px-3 py-2.5">
                  <p className="text-[9px] text-kora-muted uppercase tracking-wide truncate">{s.label}</p>
                  <p className="text-base sm:text-lg font-bold text-kora-text leading-tight mt-0.5 tabular-nums">
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Ocupación de la semana */}
            <div className="rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-semibold text-kora-text">Ocupación esta semana</p>
                <p className="text-[9px] text-kora-accent font-semibold">+12%</p>
              </div>
              <div className="flex items-end justify-between gap-1.5">
                {week.map((b, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    {/* Riel de altura FIJA (h-20) para que el % de la barra siempre resuelva */}
                    <div className="w-full h-20 flex items-end bg-kora-primary/5 rounded-md overflow-hidden">
                      <motion.div
                        className={`w-full rounded-md ${
                          b.h >= 90
                            ? "bg-gradient-to-t from-kora-primary to-kora-accent"
                            : "bg-kora-accent/50"
                        }`}
                        style={{ height: `${b.h}%`, transformOrigin: "bottom" }}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.55, delay: 0.15 + i * 0.06, ease: EASE }}
                      />
                    </div>
                    <span className="text-[8px] text-kora-muted">{b.d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reservas recientes (entran en vivo) */}
            <div className="rounded-xl border border-gray-100 p-3">
              <p className="text-[10px] font-semibold text-kora-text mb-2">Reservas recientes</p>
              <div className="space-y-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {feed.map((r) => (
                    <motion.div
                      key={r.ini + r.hab}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="flex items-center gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-full bg-kora-primary/10 text-kora-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                        {r.ini}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-kora-text leading-tight truncate">{r.nombre}</p>
                        <p className="text-[9px] text-kora-muted truncate">{r.hab}</p>
                      </div>
                      <span
                        className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          r.canal === "WhatsApp"
                            ? "bg-[#25D366]/15 text-[#128C3E]"
                            : "bg-kora-primary/10 text-kora-primary"
                        }`}
                      >
                        {r.canal}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </WindowFrame>

      {/* Tarjeta flotante: notificación de WhatsApp (sigue a la última reserva).
          Oculta en pantallas chicas: desborda el ancho del teléfono. */}
      <div
        className="animate-float absolute -top-5 -right-3 xl:-right-6 bg-white rounded-2xl shadow-xl shadow-kora-primary/10 border border-gray-100 px-3 py-2.5 hidden sm:flex items-center gap-2.5 w-48"
        aria-hidden="true"
      >
        <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
          <MessageCircle size={14} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-kora-text leading-tight">Nueva reserva</p>
          <p className="text-xs text-kora-muted truncate">{feed[0].hab} · WhatsApp</p>
        </div>
      </div>

      {/* Tarjeta flotante: métrica de reservas directas (oculta en pantallas chicas) */}
      <div
        className="animate-float-delayed absolute -bottom-6 -left-3 xl:-left-6 bg-kora-primary rounded-2xl shadow-xl shadow-kora-primary/20 px-4 py-3 text-white hidden sm:block"
        aria-hidden="true"
      >
        <p className="text-[10px] font-semibold text-kora-accent uppercase tracking-widest flex items-center gap-1">
          <Sparkles size={10} /> Reservas directas
        </p>
        <p className="text-2xl font-bold text-white leading-none mt-0.5">0%</p>
        <p className="text-[10px] text-kora-accent mt-0.5">de comisión</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chat de WhatsApp dinámico — el agente con IA cerrando una reserva          */
/* -------------------------------------------------------------------------- */

type Msg = { from: "guest" | "bot"; text: string };

const CHAT: Msg[] = [
  { from: "guest", text: "Hola, ¿tienen habitación para este fin de semana? 🙏" },
  { from: "bot", text: "¡Hola! Sí, para 2 noches tenemos la Suite Jardín en $2,400. ¿Te gustaría apartarla?" },
  { from: "guest", text: "Sí, porfa 🙌" },
  { from: "bot", text: "¡Perfecto! Tomo tus datos y el hotel te confirma el pago en un momento. 🙌" },
];

export function WhatsAppMockup() {
  const reduce = useReducedMotion();
  const contRef = useRef<HTMLDivElement>(null);
  // La conversación arranca hasta que el chat está en pantalla, para que el
  // usuario la vea desde el primer mensaje (y se pausa si sale de pantalla).
  const enVista = useInView(contRef, { amount: 0.35 });

  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [saliendo, setSaliendo] = useState(false); // fade-out antes de reiniciar

  useEffect(() => {
    if (reduce) {
      setShown(CHAT.length);
      return;
    }
    if (!enVista || saliendo) return;

    let t: ReturnType<typeof setTimeout>;

    if (shown >= CHAT.length) {
      // Conversación completa: pausa para leerla y reinicio con fundido suave.
      t = setTimeout(() => {
        setSaliendo(true);
        setTimeout(() => {
          setShown(0);
          setTyping(false);
          setSaliendo(false);
        }, 600);
      }, 4200);
      return () => clearTimeout(t);
    }

    const siguiente = CHAT[shown];
    if (siguiente.from === "bot") {
      // El bot "escribe" antes de responder.
      t = setTimeout(() => {
        setTyping(true);
        t = setTimeout(() => {
          setTyping(false);
          setShown((n) => n + 1);
        }, 1300);
      }, 500);
    } else {
      // El huésped contesta tras una pausa natural de lectura.
      t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 700 : 1400);
    }
    return () => clearTimeout(t);
  }, [shown, enVista, saliendo, reduce]);

  return (
    <div ref={contRef} className="relative select-none">
      <WindowFrame title="WhatsApp del hotel">
        {/* Cabecera del chat */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-kora-primary">
          <div className="w-8 h-8 rounded-full bg-kora-accent flex items-center justify-center text-kora-primary font-bold text-xs">
            C
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight">Camila · Asistente IA</p>
            <p className="text-[10px] text-kora-accent leading-tight">en línea · responde al instante</p>
          </div>
        </div>

        {/* Conversación (se desvanece completa al reiniciar el bucle) */}
        <motion.div
          className="p-4 space-y-2.5 bg-[#F3F1EC] min-h-[280px]"
          animate={{ opacity: saliendo ? 0 : 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <AnimatePresence initial={false}>
            {CHAT.slice(0, shown).map((m, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: 14, scale: 0.86 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 360, damping: 26, mass: 0.7 }}
                style={{
                  transformOrigin: m.from === "guest" ? "bottom right" : "bottom left",
                }}
                className={`flex ${m.from === "guest" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] px-3 py-2 text-[12px] leading-snug shadow-sm ${
                    m.from === "guest"
                      ? "bg-white text-kora-text rounded-2xl rounded-br-sm"
                      : "bg-kora-primary text-white rounded-2xl rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}

            {/* Indicador de "escribiendo…" (empuja el stack con layout, sin saltos) */}
            {typing && (
              <motion.div
                key="typing"
                layout
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 360, damping: 26, mass: 0.7 }}
                style={{ transformOrigin: "bottom left" }}
                className="flex justify-start"
              >
                <div className="bg-kora-primary/90 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-white/80 animate-bounce"
                      style={{ animationDelay: `${d * 0.15}s` }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tarjeta de reserva confirmada (cierre de la secuencia) */}
            {shown >= CHAT.length && (
              <motion.div
                key="confirmada"
                layout
                initial={{ opacity: 0, y: 14, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.5 }}
                style={{ transformOrigin: "bottom left" }}
                className="flex justify-start"
              >
                <div className="bg-white rounded-2xl border border-kora-accent/30 px-3 py-2.5 shadow-sm flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-kora-accent/20 flex items-center justify-center flex-shrink-0">
                    <Check size={14} className="text-kora-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-kora-text leading-tight">Datos listos para el hotel</p>
                    <p className="text-[10px] text-kora-muted leading-tight">Suite Jardín · 2 noches · $2,400</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </WindowFrame>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Motor de reservas dinámico — el huésped reserva y paga directo, 0% comisión */
/*  Refleja el flujo real de /h/[slug]/reservar (fechas → cuarto → pago).       */
/* -------------------------------------------------------------------------- */

export function BookingEngineMockup() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const enVista = useInView(ref, { amount: 0.35 });

  // Alterna entre "explorando" (elige cuarto) y "reservado" (carrito + pago).
  const [booked, setBooked] = useState(false);
  useEffect(() => {
    if (reduce) {
      setBooked(true);
      return;
    }
    if (!enVista) return;
    const t = setTimeout(() => setBooked((b) => !b), booked ? 3400 : 2400);
    return () => clearTimeout(t);
  }, [booked, enVista, reduce]);

  const fechas = [
    { l: "Llegada", v: "Vie 6 jun" },
    { l: "Salida", v: "Dom 8 jun" },
    { l: "Huéspedes", v: "2 adultos" },
  ];

  return (
    <div ref={ref} className="relative select-none">
      <WindowFrame title="Motor de reservas">
        <div className="p-4 sm:p-5 space-y-3.5 bg-white">
          {/* Encabezado del motor (copy real del producto) */}
          <div>
            <p className="text-[10px] font-semibold text-kora-accent uppercase tracking-widest">
              Reserva directa · Sin comisiones
            </p>
            <p className="text-sm font-bold text-kora-text mt-0.5">Hotel Paraíso Encantado</p>
            <p className="text-[10px] text-kora-muted">Confirmación inmediata · Pago seguro</p>
          </div>

          {/* Barra de fechas y huéspedes */}
          <div className="grid grid-cols-3 gap-2">
            {fechas.map((f) => (
              <div key={f.l} className="rounded-xl border border-gray-100 bg-kora-bg/40 px-2.5 py-2">
                <p className="text-[8px] text-kora-muted uppercase tracking-wide flex items-center gap-1">
                  {f.l === "Huéspedes" ? <Users size={9} /> : <Calendar size={9} />} {f.l}
                </p>
                <p className="text-[11px] font-bold text-kora-text mt-0.5 truncate tabular-nums">{f.v}</p>
              </div>
            ))}
          </div>

          {/* Tarjeta de cuarto */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex">
              {/* Foto de la habitación (Suite Jardín — selva de Xilitla) */}
              <div className="w-20 sm:w-24 flex-shrink-0 overflow-hidden bg-kora-primary/5">
                <img
                  src="/suite-jungla.jpg"
                  alt="Suite Jardín"
                  className="w-full h-full object-cover object-[65%_50%]"
                />
              </div>
              <div className="flex-1 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-bold text-kora-text leading-tight">Suite Jardín</p>
                    <p className="text-[9px] text-kora-muted">Hasta 2 personas</p>
                  </div>
                  <AnimatePresence>
                    {booked && (
                      <motion.span
                        key="agregada"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="inline-flex items-center gap-1 text-[8px] font-bold text-kora-primary bg-kora-accent/20 px-1.5 py-0.5 rounded-full flex-shrink-0"
                      >
                        <Check size={9} /> Agregada
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="flex items-end justify-between mt-2">
                  <div>
                    <p className="text-sm font-bold text-kora-text tabular-nums">$2,400 MXN</p>
                    <p className="text-[8px] text-kora-muted">total · 2 noches</p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors ${
                      booked ? "bg-kora-bg text-kora-muted" : "bg-kora-accent text-kora-primary"
                    }`}
                  >
                    {booked ? "Quitar" : "Seleccionar"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Carrito "Tu reserva" (aparece al agregar) */}
          <AnimatePresence initial={false}>
            {booked && (
              <motion.div
                key="carrito"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="rounded-xl bg-kora-bg/60 border border-gray-100 p-3 space-y-1">
                  <p className="text-[10px] font-semibold text-kora-text">Tu reserva</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-kora-muted">Total estadía</span>
                    <span className="font-bold text-kora-text tabular-nums">$2,400 MXN</span>
                  </div>
                  <p className="text-[9px] text-kora-muted">
                    Pagas ahora el 50% ($1,200). El resto al llegar.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botón de pago (se activa al reservar) */}
          <div
            className={`w-full py-2.5 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
              booked ? "bg-kora-primary text-white" : "bg-kora-primary/25 text-white/70"
            }`}
          >
            <Lock size={12} /> Pagar $1,200 — Anticipo 50%
          </div>

          {/* Trust badges reales del motor */}
          <div className="flex items-center justify-center gap-3 text-[9px] text-kora-muted">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={10} className="text-kora-primary" /> Pago seguro
            </span>
            <span className="inline-flex items-center gap-1">
              <Check size={10} className="text-kora-primary" /> Confirmación inmediata
            </span>
          </div>
        </div>
      </WindowFrame>

      {/* Toast de confirmación (al completar la reserva) */}
      <AnimatePresence>
        {booked && (
          <motion.div
            key="confirmada"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 24, delay: 0.4 }}
            className="absolute -top-4 right-3 xl:-right-4 bg-white rounded-2xl shadow-xl shadow-kora-primary/15 border border-kora-accent/30 px-3 py-2 flex items-center gap-2"
            aria-hidden="true"
          >
            <div className="w-6 h-6 rounded-full bg-kora-accent/20 flex items-center justify-center flex-shrink-0">
              <Check size={13} className="text-kora-primary" />
            </div>
            <p className="text-[11px] font-bold text-kora-text">¡Reserva confirmada!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tarjeta flotante: 0% comisión, 100% tuyo */}
      <div
        className="animate-float-delayed absolute -bottom-5 -left-3 xl:-left-6 bg-kora-primary rounded-2xl shadow-xl shadow-kora-primary/20 px-4 py-3 text-white hidden sm:block"
        aria-hidden="true"
      >
        <p className="text-[10px] font-semibold text-kora-accent uppercase tracking-widest flex items-center gap-1">
          <Sparkles size={10} /> Reservas directas
        </p>
        <p className="text-2xl font-bold text-white leading-none mt-0.5">0%</p>
        <p className="text-[10px] text-kora-accent mt-0.5">de comisión · 100% tuyo</p>
      </div>
    </div>
  );
}
