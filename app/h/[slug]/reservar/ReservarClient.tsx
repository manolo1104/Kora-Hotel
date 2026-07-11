"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Users,
  Plus,
  Minus,
  ChevronRight,
  X,
  ShieldCheck,
  CalendarDays,
  Check,
  Ban,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  Lock,
  Flame,
} from "lucide-react";
import {
  type BookingRoom,
  type CartItem,
  type AddonRule,
  type RatePlan,
  calcRoomStayTotal,
  calcNights,
  calcCartSubtotal,
  calcDepositAmount,
  calcAddonsTotal,
  calcNrfDiscount,
  calcTaxBreakdown,
  formatMXN,
  type Temporada,
  type RecargoFinDeSemana,
} from "@/lib/booking";
import { t, localeOf, normalizeLang, LANG_KEY, type Lang } from "@/lib/booking/i18n";
import {
  trackViewItems,
  trackBeginCheckout,
  trackAddPaymentInfo,
  type MotorItem,
} from "@/lib/booking/track";
import { DateRangeCalendar } from "@/components/booking/DateRangeCalendar";

// ── Props ────────────────────────────────────────────────
interface Props {
  slug: string;
  hotelNombre: string;
  whatsapp: string | null;
  rooms: BookingRoom[];
  brandColor: string;
  brandInk: string;
  accentColor: string;
  accentInk: string;
  fontStack: string;
  logoUrl: string | null;
  coverUrl: string | null;
  marcaOculta: boolean;
  demo?: boolean; // hotel de demostración: el pago se simula, nada se cobra
  addons: AddonRule[];
  politicaCancelacion: string | null;
  pagoEnHotel: boolean; // el hotel permite reservar con tarjeta-garantía
  oxxoDisponible: boolean; // la cuenta Stripe del hotel acepta OXXO
  reglas: {
    anticipoPct: number;
    anticipoMinNoches: number;
    minNoches: number;
    nrfActiva: boolean;
    nrfPct: number;
    cancelacionDias: number;
    ishPct: number;
    weekdayDiscount: number;
    weekdayDiscountUntil?: string;
    temporadas: Temporada[];
    recargoFinDeSemana: RecargoFinDeSemana | null;
  };
}

type Step = "buscar" | "datos" | "pago";

// Placeholder visual cuando un cuarto no trae imagen.
function RoomPlaceholder({ name }: { name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "color-mix(in srgb, var(--brand) 16%, white)" }}
    >
      <span className="text-3xl font-extrabold" style={{ color: "var(--brand)" }}>
        {initial}
      </span>
    </div>
  );
}

// Galería por habitación: flechas + puntos cuando hay más de una foto.
function RoomGallery({ room, lang }: { room: BookingRoom; lang: Lang }) {
  const images = (room.images?.length ? room.images : room.image ? [room.image] : []).slice(0, 8);
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return <RoomPlaceholder name={room.name} />;
  const go = (d: number) => setIdx((i) => (i + d + images.length) % images.length);
  return (
    <div className="relative h-full w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[idx]}
        alt={t(lang, "fotoDe", { i: idx + 1, n: images.length, room: room.name })}
        className="h-full w-full object-cover"
      />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label={t(lang, "fotoAnterior")}
            className="absolute left-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label={t(lang, "fotoSiguiente")}
            className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65"
          >
            <ChevronRight size={15} />
          </button>
          <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1" aria-hidden="true">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Indicador de progreso del flujo (1 Fechas · 2 Datos · 3 Pago).
function Stepper({ step, lang }: { step: Step; lang: Lang }) {
  const steps: { key: Step; label: string }[] = [
    { key: "buscar", label: t(lang, "pasoFechas") },
    { key: "datos", label: t(lang, "pasoDatos") },
    { key: "pago", label: t(lang, "pasoPago") },
  ];
  const activeIdx = steps.findIndex((s) => s.key === step);
  return (
    <ol className="mb-5 flex items-center justify-center gap-1.5 sm:gap-2" aria-label={`${activeIdx + 1}/3`}>
      {steps.map((s, i) => {
        const active = i === activeIdx;
        const done = i < activeIdx;
        return (
          <li key={s.key} className="flex items-center gap-1.5 sm:gap-2" aria-current={active ? "step" : undefined}>
            <span
              className="grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold"
              style={
                active || done
                  ? { background: "var(--brand)", color: "var(--brand-ink)" }
                  : { background: "#e5e7eb", color: "#6b7280" }
              }
            >
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span className={`text-xs font-semibold ${active ? "" : "text-kora-muted"}`}>{s.label}</span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-gray-200 sm:w-8" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function soloDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

const EMAIL_RE = /.+@.+\..+/;

export default function ReservarClient({
  slug,
  hotelNombre,
  whatsapp,
  rooms,
  brandColor,
  brandInk,
  accentColor,
  accentInk,
  fontStack,
  logoUrl,
  coverUrl,
  marcaOculta,
  demo = false,
  addons,
  politicaCancelacion,
  pagoEnHotel,
  oxxoDisponible,
  reglas,
}: Props) {
  // ── Idioma (toggle ES/EN; se recuerda) ─────────────────
  const [lang, setLang] = useState<Lang>("es");
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("lang");
      if (q === "en" || q === "es") {
        setLang(q);
        localStorage.setItem(LANG_KEY, q);
      } else {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved) setLang(normalizeLang(saved));
      }
    } catch {
      /* sin storage */
    }
  }, []);
  function switchLang(l: Lang) {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* sin storage */
    }
  }

  // ── Fechas + huéspedes ──────────────────────────────────
  // "Hoy" en la zona del hotel (no UTC): con toISOString(), un huésped en
  // México después de las ~6 p.m. veía "hoy" corrido un día, y el SSR (UTC)
  // no coincidía con el cliente.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const initialCheckout = (() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + Math.max(1, reglas.minNoches));
    return d.toISOString().split("T")[0];
  })();

  const [checkin, setCheckin] = useState(today);
  const [checkout, setCheckout] = useState(initialCheckout);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  // Prefill desde la URL (?checkin=&checkout=&adults=&children=): lo usa el
  // email de recuperación de abandono para retomar la búsqueda donde quedó.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      // Regresó de un Checkout cancelado: liberar SU hold de inmediato para
      // que su propio carrito no le bloquee el cuarto (ni a otros) ~30 min.
      const hs = q.get("hs") ?? "";
      if (q.get("cancelado") === "1" && /^web_[0-9a-f-]{36}$/.test(hs)) {
        fetch(`/api/h/${slug}/hold`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: hs }),
        }).catch(() => {});
      }
      const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
      const qIn = q.get("checkin") ?? "";
      const qOut = q.get("checkout") ?? "";
      if (DATE_RE.test(qIn) && DATE_RE.test(qOut) && qIn >= today && qOut > qIn) {
        setCheckin(qIn);
        setCheckout(qOut);
      }
      const qAdults = Number(q.get("adults"));
      if (Number.isInteger(qAdults) && qAdults >= 1 && qAdults <= 10) setAdults(qAdults);
      const qChildren = Number(q.get("children"));
      if (Number.isInteger(qChildren) && qChildren >= 0 && qChildren <= 10) setChildren(qChildren);
    } catch {
      /* sin URL válida */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [totalRooms, setTotalRooms] = useState<number | null>(null);
  const [searchError, setSearchError] = useState("");

  // Fechas con el hotel lleno → el calendario las bloquea.
  const [fullDates, setFullDates] = useState<string[]>([]);
  useEffect(() => {
    fetch(`/api/h/${slug}/fully-booked`)
      .then((r) => r.json())
      .then((d) => setFullDates(Array.isArray(d?.dates) ? d.dates : []))
      .catch(() => {});
  }, [slug]);

  // ── Carrito ─────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
  function toggleAddon(i: number) {
    setSelectedAddons((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  }

  // ── Flujo (3 pasos) ─────────────────────────────────────
  const [step, setStep] = useState<Step>("buscar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [ratePlan, setRatePlan] = useState<RatePlan>("flex");
  const [payMode, setPayMode] = useState<"online" | "hotel">("online");
  const [acepta, setAcepta] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const resultsRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  // Al cambiar de paso: scroll arriba + foco al título (teclado/lector).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    stepHeadingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const nights = useMemo(() => calcNights(checkin, checkout), [checkin, checkout]);

  // ── Helpers de cuarto ──────────────────────────────────
  const findRoom = (id: number | string) => rooms.find((r) => r.id === id);
  const isUnavailable = (r: BookingRoom) => unavailable.includes(r.name);
  const inCart = (id: number | string) => cart.some((c) => c.roomId === id);

  function getRoomGuests(room: BookingRoom): number {
    return Math.max(1, Math.min(adults, room.maxGuests || adults));
  }

  // ── Reset al cambiar fechas/huéspedes ──────────────────
  function resetSearch() {
    setSearched(false);
    setUnavailable([]);
    setAvailableCount(null);
    setCart([]);
    setSearchError("");
  }

  function handleDatesChange(ci: string, co: string) {
    setCheckin(ci);
    setCheckout(co);
    resetSearch();
  }

  // ── Buscar disponibilidad ──────────────────────────────
  async function handleSearch() {
    if (!checkin || !checkout || nights <= 0) return;
    setSearching(true);
    setSearchError("");
    setCart([]);
    try {
      const res = await fetch(`/api/h/${slug}/check-availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkin, checkout, rooms: rooms.map((r) => r.name) }),
      });
      const data = await res.json();
      const unav: string[] = Array.isArray(data?.unavailableRooms) ? data.unavailableRooms : [];
      setUnavailable(unav);
      setAvailableCount(typeof data?.availableCount === "number" ? data.availableCount : null);
      setTotalRooms(typeof data?.totalRooms === "number" ? data.totalRooms : null);
      // Medición: vio precios reales de los cuartos disponibles.
      const items: MotorItem[] = rooms
        .filter((r) => !unav.includes(r.name))
        .map((r) => ({
          item_id: String(r.id),
          item_name: r.name,
          price: calcRoomStayTotal(r, getRoomGuests(r), checkin, checkout, priceOpts),
          quantity: 1,
        }));
      if (items.length > 0) {
        trackViewItems(items, items.reduce((s, i) => s + (i.price ?? 0), 0));
      }
    } catch {
      setUnavailable([]);
      setAvailableCount(null);
      setSearchError(t(lang, "errVerificar"));
    } finally {
      setSearching(false);
      setSearched(true);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }
  }

  // ── Carrito ─────────────────────────────────────────────
  function addToCart(room: BookingRoom) {
    if (inCart(room.id)) return;
    const assigned = cart.reduce((s, i) => s + i.guestCount, 0);
    const remaining = Math.max(1, adults - assigned);
    const guestCount = Math.min(remaining, room.maxGuests || remaining);
    setCart((prev) => [...prev, { roomId: room.id, guestCount }]);
  }
  function removeFromCart(roomId: number | string) {
    setCart((prev) => prev.filter((c) => c.roomId !== roomId));
  }
  function updateGuests(roomId: number | string, delta: number) {
    setCart((prev) =>
      prev.map((item) => {
        if (item.roomId !== roomId) return item;
        const r = findRoom(roomId);
        const max = r?.maxGuests ?? item.guestCount;
        return { ...item, guestCount: Math.max(1, Math.min(max, item.guestCount + delta)) };
      }),
    );
  }

  // ── Totales (estimación cliente; el servidor revalida) ─
  const priceOpts = useMemo(
    () => ({
      weekdayDiscount: reglas.weekdayDiscount,
      weekdayDiscountUntil: reglas.weekdayDiscountUntil,
      temporadas: reglas.temporadas,
      recargoFinDeSemana: reglas.recargoFinDeSemana ?? undefined,
    }),
    [reglas.weekdayDiscount, reglas.weekdayDiscountUntil, reglas.temporadas, reglas.recargoFinDeSemana],
  );
  const subtotal = useMemo(
    () => calcCartSubtotal(rooms, cart, checkin, checkout, priceOpts),
    [rooms, cart, checkin, checkout, priceOpts],
  );
  const addonsTotal = useMemo(
    () => calcAddonsTotal(addons, selectedAddons, nights, adults),
    [addons, selectedAddons, nights, adults],
  );
  // La tarifa No Reembolsable exige prepago: no aplica con "pagar en hotel".
  const esNrf = ratePlan === "nrf" && reglas.nrfActiva && payMode === "online";
  const nrfDiscount = esNrf ? calcNrfDiscount(subtotal, reglas.nrfPct) : 0;
  const total = Math.max(0, subtotal - nrfDiscount + addonsTotal);
  const deposit = useMemo(
    () =>
      calcDepositAmount(total, nights, {
        pct: reglas.anticipoPct,
        minNights: reglas.anticipoMinNoches,
      }),
    [total, nights, reglas.anticipoPct, reglas.anticipoMinNoches],
  );
  const isDeposit = deposit < total;
  const desglose = useMemo(() => calcTaxBreakdown(total, reglas.ishPct), [total, reglas.ishPct]);

  const cartHasUnavailable = cart.some((item) => {
    const room = findRoom(item.roomId);
    return room && unavailable.includes(room.name);
  });
  const cartCapacity = cart.reduce((s, item) => s + (findRoom(item.roomId)?.maxGuests ?? 0), 0);
  const capacityOk = cart.length === 0 || cartCapacity >= adults;
  const canContinue =
    cart.length > 0 && checkin && checkout && nights > 0 && !cartHasUnavailable && capacityOk;

  // Señal de urgencia REAL: calculada del inventario, solo si de verdad quedan
  // pocas habitaciones libres y alguna ya está ocupada.
  const urgencyCount =
    availableCount !== null &&
    totalRooms !== null &&
    availableCount >= 1 &&
    availableCount <= 2 &&
    availableCount < totalRooms
      ? availableCount
      : null;

  function cartItems(): MotorItem[] {
    return cart.map((item) => {
      const room = findRoom(item.roomId)!;
      return {
        item_id: String(room.id),
        item_name: room.name,
        price: calcRoomStayTotal(room, item.guestCount, checkin, checkout, priceOpts),
        quantity: 1,
      };
    });
  }

  // ── Captura temprana de email (recuperación de abandono) ─
  const lastIntent = useRef("");
  function captureIntent(currentEmail: string, currentName?: string) {
    if (demo) return; // a quien juega con el demo no se le escribe
    const e = currentEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return;
    const key = `${e}|${currentName ?? ""}`;
    if (lastIntent.current === key) return;
    lastIntent.current = key;
    fetch(`/api/h/${slug}/intento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: e,
        nombre: currentName?.trim() || undefined,
        lang,
        payload: { checkin, checkout, adults, children, cart, addons: selectedAddons },
      }),
    }).catch(() => {});
  }

  // ── Avanzar de paso ────────────────────────────────────
  function goDatos() {
    if (!canContinue) return;
    setPayError("");
    setStep("datos");
    trackBeginCheckout(cartItems(), total);
  }

  function goPago() {
    if (!EMAIL_RE.test(email.trim())) {
      setPayError(t(lang, "errCorreoInvalido"));
      return;
    }
    if (!name.trim() || !phone.trim()) {
      setPayError(t(lang, "errCompletaDatos"));
      return;
    }
    setPayError("");
    captureIntent(email, name);
    setStep("pago");
    trackAddPaymentInfo(cartItems(), total);
  }

  // ── Modo demo: el pago se simula (nada llega a Stripe ni a la BD) ─
  const [demoOk, setDemoOk] = useState(false);
  const [demoFolio, setDemoFolio] = useState("");

  // ── Pagar / reservar ───────────────────────────────────
  async function handlePay() {
    if (!canContinue) return;
    if (!acepta) {
      setPayError(t(lang, "errAceptaPolitica"));
      return;
    }
    if (demo) {
      setPaying(true);
      setPayError("");
      setTimeout(() => {
        setDemoFolio(`DEMO-2026-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
        setDemoOk(true);
        setPaying(false);
      }, 700);
      return;
    }
    setPaying(true);
    setPayError("");
    try {
      const res = await fetch(`/api/h/${slug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart,
          addons: selectedAddons,
          checkin,
          checkout,
          customerName: name.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          adults,
          children,
          ratePlan: esNrf ? "nrf" : "flex",
          payMode,
          aceptaPolitica: true,
          lang,
        }),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        const unav: string[] = Array.isArray(data?.unavailableRooms) ? data.unavailableRooms : [];
        setUnavailable(unav);
        setCart((prev) => prev.filter((c) => !unav.includes(findRoom(c.roomId)?.name ?? "")));
        setStep("buscar");
        setSearched(true);
        setPaying(false);
        setSearchError(t(lang, "errOcupadas"));
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
        return;
      }

      const data = await res.json().catch(() => ({}));

      // Éxito con Stripe → redirige al checkout hospedado.
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }

      // Sin Stripe configurado → flujo WhatsApp (el mensaje al hotel va en español).
      if (data?.whatsapp) {
        const num = soloDigitos((data.whatsappNumber as string) || whatsapp || "");
        const stay = typeof data.stayTotal === "number" ? data.stayTotal : total;
        const dep = typeof data.deposit === "number" ? data.deposit : deposit;
        const roomLines = cart
          .map((item) => {
            const room = findRoom(item.roomId)!;
            const tt = calcRoomStayTotal(room, item.guestCount, checkin, checkout, priceOpts);
            return `• ${room.name} (${item.guestCount} persona${item.guestCount > 1 ? "s" : ""}) — ${formatMXN(tt)}`;
          })
          .join("\n");
        const msg = [
          `¡Hola! Quiero reservar en ${hotelNombre}.`,
          "",
          `*Nombre:* ${name.trim()}`,
          `*Correo:* ${email.trim()}`,
          `*Tel:* ${phone.trim()}`,
          "",
          `*Llegada:* ${checkin}`,
          `*Salida:* ${checkout}`,
          `*Noches:* ${nights}`,
          `*Adultos:* ${adults}${children > 0 ? ` · *Menores:* ${children}` : ""}`,
          "",
          "*Habitaciones:*",
          roomLines,
          esNrf ? `*Tarifa:* No reembolsable (−${reglas.nrfPct}%)` : "",
          "",
          `*Total estadía:* ${formatMXN(stay)}`,
          isDeposit ? `*Anticipo (${reglas.anticipoPct}%):* ${formatMXN(dep)}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        if (num) {
          window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
          setPaying(false);
        } else {
          setPayError(t(lang, "errSinPago"));
          setPaying(false);
        }
        return;
      }

      // Otros errores
      setPayError(typeof data?.error === "string" ? errorMsg(data.error) : t(lang, "errPago"));
      setPaying(false);
    } catch {
      setPayError(t(lang, "errConexion"));
      setPaying(false);
    }
  }

  function errorMsg(code: string): string {
    if (code === "hotel-no-encontrado") return t(lang, "errHotel");
    if (code === "no-disponible") return t(lang, "errNoDisponible");
    return code;
  }

  // Si se vacía el carrito estando en datos/pago, regresa a buscar.
  useEffect(() => {
    if (step !== "buscar" && cart.length === 0) setStep("buscar");
  }, [cart.length, step]);

  const fmtFecha = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(localeOf(lang), { day: "numeric", month: "short" });

  // Texto de política de cancelación (custom del hotel o default estructurado).
  const politicaFlex =
    politicaCancelacion ||
    (reglas.cancelacionDias === 0
      ? t(lang, "politicaDefaultFlex0")
      : t(lang, "politicaDefaultFlex", { n: reglas.cancelacionDias }));
  const politicaActiva = esNrf ? t(lang, "politicaNrf") : politicaFlex;

  // ── Render ──────────────────────────────────────────────
  return (
    <div
      className="min-h-screen w-full bg-kora-bg text-kora-text antialiased"
      style={
        {
          "--brand": brandColor,
          "--brand-ink": brandInk,
          "--accent": accentColor,
          "--accent-ink": accentInk,
          fontFamily: fontStack,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {/* Toggle de idioma */}
        <div className="mb-3 flex justify-end">
          <div className="inline-flex overflow-hidden rounded-full border border-gray-200 bg-white text-xs font-bold" role="group" aria-label="Idioma / Language">
            {(["es", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => switchLang(l)}
                aria-pressed={lang === l}
                className="px-3 py-1.5 uppercase transition-colors"
                style={lang === l ? { background: "var(--brand)", color: "var(--brand-ink)" } : undefined}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Encabezado: portada con foto del hotel, o cabecera de texto */}
        {coverUrl ? (
          <header className="mb-5 overflow-hidden rounded-2xl">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt={hotelNombre} className="h-44 w-full object-cover sm:h-52" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/90">{t(lang, "badge")}</p>
                <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {hotelNombre}
                </h1>
                <p className="mt-0.5 text-sm text-white/85">{t(lang, "tagline")}</p>
              </div>
            </div>
          </header>
        ) : (
          <header className="mb-5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={hotelNombre}
                className="mb-3 h-10 w-auto max-w-[180px] object-contain"
              />
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--brand)" }}>
              {t(lang, "badge")}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{hotelNombre}</h1>
            <p className="mt-1 text-sm text-kora-muted">{t(lang, "tagline")}</p>
          </header>
        )}

        {/* Aviso permanente del hotel de demostración */}
        {demo && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-900">
            <span aria-hidden="true">🧪</span> {t(lang, "demoBanner")}
          </div>
        )}

        <Stepper step={step} lang={lang} />

        {step === "buscar" && (
          <>
            {/* ── Paso 1: fechas + habitaciones ── */}
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <DateRangeCalendar
                checkin={checkin}
                checkout={checkout}
                onChange={handleDatesChange}
                fullDates={fullDates}
                minNights={reglas.minNoches}
                lang={lang}
                today={today}
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-kora-muted">{t(lang, "adultos")}</span>
                  <Counter
                    value={adults}
                    onDec={() => {
                      setAdults((a) => Math.max(1, a - 1));
                      resetSearch();
                    }}
                    onInc={() => {
                      setAdults((a) => Math.min(20, a + 1));
                      resetSearch();
                    }}
                    min={1}
                    decLabel={t(lang, "menosAdultos")}
                    incLabel={t(lang, "masAdultos")}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-kora-muted">{t(lang, "menores")}</span>
                  <Counter
                    value={children}
                    onDec={() => setChildren((c) => Math.max(0, c - 1))}
                    onInc={() => setChildren((c) => Math.min(20, c + 1))}
                    min={0}
                    decLabel="−"
                    incLabel="+"
                  />
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={!checkin || !checkout || nights <= 0 || searching}
                className="btn-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {searching ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> {t(lang, "verificando")}
                  </>
                ) : searched ? (
                  t(lang, "actualizarDisponibilidad")
                ) : (
                  t(lang, "verDisponibilidad")
                )}
              </button>

              {nights > 0 && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-kora-muted">
                  <CalendarDays size={13} aria-hidden="true" />
                  {t(lang, "nochesResumen", { n: nights, desde: fmtFecha(checkin), hasta: fmtFecha(checkout) })}
                </p>
              )}
              {searchError && (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="alert">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {searchError}
                </p>
              )}
            </section>

            {/* ── Grid de cuartos ── */}
            <div ref={resultsRef} className="mt-6" aria-live="polite">
              {!searched && !searching && (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-kora-muted">
                  <CalendarDays size={18} style={{ color: "var(--brand)" }} aria-hidden="true" />
                  <span>{t(lang, "eligeFechas", { btn: t(lang, "verDisponibilidad") })}</span>
                </div>
              )}

              {searching && (
                <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-5 text-sm text-kora-muted">
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--brand)" }} aria-hidden="true" />
                  {t(lang, "consultando")}
                </div>
              )}

              {searched && !searching && rooms.length === 0 && (
                <p className="rounded-xl border border-gray-100 bg-white px-4 py-5 text-sm text-kora-muted">
                  {t(lang, "sinHabitaciones")}
                </p>
              )}

              {searched && !searching && urgencyCount !== null && (
                <p className="mb-3 flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
                  <Flame size={15} className="shrink-0" aria-hidden="true" />
                  {urgencyCount === 1 ? t(lang, "urgencia1") : t(lang, "urgenciaN", { n: urgencyCount })}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {rooms.map((room) => {
                  const unavail = isUnavailable(room);
                  const added = inCart(room.id);
                  const guests = getRoomGuests(room);
                  const roomTotal = searched
                    ? calcRoomStayTotal(room, guests, checkin, checkout, priceOpts)
                    : null;
                  return (
                    <article
                      key={room.id}
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
                        added ? "border-[var(--brand)]" : "border-gray-100"
                      } ${unavail ? "opacity-70" : ""}`}
                    >
                      <div className="relative h-40 w-full">
                        <RoomGallery room={room} lang={lang} />
                        {unavail && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 text-white">
                            <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                              <Ban size={14} aria-hidden="true" /> {t(lang, "noDisponible")}
                            </span>
                            <span className="text-[11px] opacity-90">{t(lang, "agotadaFechas")}</span>
                          </div>
                        )}
                        {added && !unavail && (
                          <div
                            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                          >
                            <Check size={12} aria-hidden="true" /> {t(lang, "agregada")}
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="font-bold leading-tight">{room.name}</h3>
                        {room.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-kora-muted">{room.description}</p>
                        )}
                        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-kora-muted">
                          <Users size={12} aria-hidden="true" /> {t(lang, "hastaPersonas", { n: room.maxGuests })}
                        </p>

                        {room.features && room.features.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {room.features.slice(0, 3).map((f) => (
                              <span
                                key={f}
                                className="rounded-full border border-gray-100 bg-kora-bg px-2 py-0.5 text-[11px] text-kora-text"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex items-end justify-between gap-3">
                          <div>
                            <span className="block text-lg font-extrabold tabular-nums" style={{ color: "var(--brand)" }}>
                              {searched && roomTotal !== null ? formatMXN(roomTotal) : formatMXN(room.price)}
                            </span>
                            <span className="block text-[11px] text-kora-muted">
                              {searched && roomTotal !== null
                                ? t(lang, "totalPax", { n: nights, g: guests })
                                : t(lang, "porNoche")}
                            </span>
                          </div>

                          {unavail ? (
                            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-kora-muted">
                              {t(lang, "agotada")}
                            </span>
                          ) : searched ? (
                            <button
                              onClick={() => (added ? removeFromCart(room.id) : addToCart(room))}
                              className="btn-press inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold"
                              style={
                                added
                                  ? { border: "1px solid var(--brand)", color: "var(--brand)", background: "white" }
                                  : { background: "var(--accent)", color: "var(--accent-ink)" }
                              }
                            >
                              {added ? (
                                <>
                                  <X size={12} aria-hidden="true" /> {t(lang, "quitar")}
                                </>
                              ) : (
                                t(lang, "seleccionar")
                              )}
                            </button>
                          ) : (
                            <span className="text-[11px] text-kora-muted">{t(lang, "buscaFechas")}</span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* ── Carrito (resumen) ── */}
            {cart.length > 0 && (
              <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold">{t(lang, "tuReserva")}</h2>

                <div className="mt-3 space-y-3">
                  {cart.map((item) => {
                    const room = findRoom(item.roomId)!;
                    const tt = calcRoomStayTotal(room, item.guestCount, checkin, checkout, priceOpts);
                    const unav = unavailable.includes(room.name);
                    return (
                      <div key={item.roomId} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold">{room.name}</span>
                          <button
                            onClick={() => removeFromCart(item.roomId)}
                            aria-label={`${t(lang, "quitar")} ${room.name}`}
                            className="text-kora-muted hover:text-kora-text"
                          >
                            <X size={15} />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="inline-flex items-center gap-2 text-sm">
                            <button
                              onClick={() => updateGuests(item.roomId, -1)}
                              disabled={item.guestCount <= 1}
                              className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 disabled:opacity-40"
                              aria-label={t(lang, "menosAdultos")}
                            >
                              <Minus size={12} />
                            </button>
                            <span className="tabular-nums">
                              {item.guestCount} {item.guestCount === 1 ? t(lang, "adulto") : t(lang, "adultos_pl")}
                            </span>
                            <button
                              onClick={() => updateGuests(item.roomId, 1)}
                              disabled={item.guestCount >= room.maxGuests}
                              className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 disabled:opacity-40"
                              aria-label={t(lang, "masAdultos")}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <span className="font-semibold tabular-nums">{formatMXN(tt)}</span>
                        </div>
                        {unav && (
                          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-700">
                            <AlertTriangle size={12} aria-hidden="true" /> {t(lang, "yaNoDisponible")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!capacityOk && (
                  <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {t(lang, "capacidadAviso", { a: adults, c: cartCapacity })}
                  </p>
                )}

                {addons.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-sm font-bold">{t(lang, "quieresAgregar")}</p>
                    <div className="mt-2 space-y-2">
                      {addons.map((a, i) => {
                        const on = selectedAddons.includes(i);
                        const unit =
                          a.tipo === "noche"
                            ? t(lang, "unitNoche", { p: formatMXN(a.precio) })
                            : a.tipo === "persona"
                              ? t(lang, "unitPersona", { p: formatMXN(a.precio) })
                              : formatMXN(a.precio);
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleAddon(i)}
                            aria-pressed={on}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors"
                            style={
                              on
                                ? {
                                    borderColor: "var(--brand)",
                                    background: "color-mix(in srgb, var(--brand) 7%, white)",
                                  }
                                : { borderColor: "#e5e7eb" }
                            }
                          >
                            <span className="flex items-center gap-2.5">
                              <span
                                className="grid h-5 w-5 place-items-center rounded-md border"
                                style={
                                  on
                                    ? { background: "var(--brand)", borderColor: "var(--brand)" }
                                    : { borderColor: "#d1d5db" }
                                }
                              >
                                {on && <Check size={13} style={{ color: "var(--brand-ink)" }} aria-hidden="true" />}
                              </span>
                              <span className="text-sm font-semibold">{a.nombre}</span>
                            </span>
                            <span className="text-sm tabular-nums text-kora-muted">{unit}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-kora-muted">{t(lang, "subtotal")}</span>
                    <span className="tabular-nums">{formatMXN(subtotal)}</span>
                  </div>
                  {addonsTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-kora-muted">{t(lang, "extrasLinea")}</span>
                      <span className="tabular-nums">{formatMXN(addonsTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold">
                    <span>{t(lang, "totalEstadia")}</span>
                    <span className="tabular-nums" style={{ color: "var(--brand)" }}>
                      {formatMXN(subtotal + addonsTotal)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={goDatos}
                  disabled={!canContinue}
                  className="btn-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  {t(lang, "continuar")} <ChevronRight size={16} aria-hidden="true" />
                </button>

                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-kora-muted">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={12} aria-hidden="true" /> {t(lang, "pagoSeguro")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={12} aria-hidden="true" /> {t(lang, "confirmacionInmediata")}
                  </span>
                </div>
              </section>
            )}
          </>
        )}

        {step === "datos" && (
          /* ── Paso 2: datos del huésped (correo PRIMERO) ── */
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <button
              onClick={() => setStep("buscar")}
              className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-kora-muted hover:text-kora-text"
            >
              <ChevronLeft size={15} aria-hidden="true" /> {t(lang, "volver")}
            </button>

            <h2 ref={stepHeadingRef} tabIndex={-1} className="text-lg font-bold outline-none">
              {t(lang, "datosTitulo")}
            </h2>
            <p className="mt-1 text-sm text-kora-muted">{t(lang, "datosSub")}</p>

            <div className="mt-4 grid gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-kora-muted">{t(lang, "correoLabel")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => captureIntent(email)}
                  placeholder={t(lang, "correoPlaceholder")}
                  autoComplete="email"
                  inputMode="email"
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-kora-muted">{t(lang, "nombreLabel")}</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t(lang, "nombrePlaceholder")}
                  autoComplete="name"
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-kora-muted">{t(lang, "telLabel")}</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t(lang, "telPlaceholder")}
                  autoComplete="tel"
                  inputMode="tel"
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                />
              </label>
            </div>

            {/* Resumen compacto */}
            <div className="mt-5 rounded-xl border border-gray-100 bg-kora-bg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-kora-muted">
                  <CalendarDays size={14} aria-hidden="true" />
                  {t(lang, "nochesResumen", { n: nights, desde: fmtFecha(checkin), hasta: fmtFecha(checkout) })}
                </span>
                <span className="inline-flex items-center gap-1.5 text-kora-muted">
                  <Users size={14} aria-hidden="true" /> {adults}{" "}
                  {adults === 1 ? t(lang, "adulto") : t(lang, "adultos_pl")}
                  {children > 0 ? ` · ${children} ${t(lang, "menores").toLowerCase()}` : ""}
                </span>
              </div>
              <div className="mt-3 space-y-1.5">
                {cart.map((item) => {
                  const room = findRoom(item.roomId)!;
                  const tt = calcRoomStayTotal(room, item.guestCount, checkin, checkout, priceOpts);
                  return (
                    <div key={item.roomId} className="flex justify-between text-sm">
                      <span>
                        {room.name} · {item.guestCount}p
                      </span>
                      <span className="tabular-nums">{formatMXN(tt)}</span>
                    </div>
                  );
                })}
                {selectedAddons.map((i) => {
                  const a = addons[i];
                  if (!a) return null;
                  const tt =
                    a.tipo === "noche"
                      ? a.precio * Math.max(1, nights)
                      : a.tipo === "persona"
                        ? a.precio * Math.max(1, adults)
                        : a.precio;
                  return (
                    <div key={`a-${i}`} className="flex justify-between text-sm text-kora-muted">
                      <span>+ {a.nombre}</span>
                      <span className="tabular-nums">{formatMXN(tt)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-base font-bold">
                <span>{t(lang, "totalEstadia")}</span>
                <span className="tabular-nums" style={{ color: "var(--brand)" }}>
                  {formatMXN(subtotal + addonsTotal)}
                </span>
              </div>
            </div>

            {payError && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {payError}
              </p>
            )}

            <button
              onClick={goPago}
              className="btn-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              {t(lang, "continuarPago")} <ChevronRight size={16} aria-hidden="true" />
            </button>
          </section>
        )}

        {/* ── Confirmación SIMULADA del modo demo (aquí termina el juego) ── */}
        {step === "pago" && demoOk && (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
            <div
              className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full"
              style={{ background: "color-mix(in srgb, var(--brand) 14%, white)" }}
            >
              <Check size={28} style={{ color: "var(--brand)" }} aria-hidden="true" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              {t(lang, "demoConfTitulo")}
            </h2>
            <p className="mx-auto mt-1 inline-block rounded-full bg-kora-bg px-3 py-1 text-xs font-bold tracking-wide text-kora-muted">
              {t(lang, "confFolio")}: {demoFolio}
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-kora-muted">
              {t(lang, "demoConfTexto")}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <a
                href="/#contacto"
                target="_top"
                className="btn-press inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold transition-opacity hover:opacity-90"
                style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
              >
                {t(lang, "demoConfCTA")}
              </a>
              <button
                type="button"
                onClick={() => {
                  setDemoOk(false);
                  setStep("buscar");
                }}
                className="text-sm font-semibold text-kora-muted underline hover:text-kora-text"
              >
                {t(lang, "demoConfOtra")}
              </button>
            </div>
          </section>
        )}

        {step === "pago" && !demoOk && (
          /* ── Paso 3: tarifa, desglose, política y pago ── */
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <button
              onClick={() => setStep("datos")}
              className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-kora-muted hover:text-kora-text"
            >
              <ChevronLeft size={15} aria-hidden="true" /> {t(lang, "volver")}
            </button>

            <h2 ref={stepHeadingRef} tabIndex={-1} className="text-lg font-bold outline-none">
              {t(lang, "pagoTitulo")}
            </h2>

            {/* Forma de pago: en línea vs al llegar (si el hotel lo permite) */}
            {pagoEnHotel && (
              <fieldset className="mt-4">
                <legend className="text-sm font-bold">{t(lang, "comoPagar")}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        mode: "online" as const,
                        titulo: t(lang, "pagoOnline"),
                        desc: oxxoDisponible
                          ? t(lang, "pagoOnlineDescOxxo")
                          : t(lang, "pagoOnlineDescCard"),
                      },
                      {
                        mode: "hotel" as const,
                        titulo: t(lang, "pagoHotelOpt"),
                        desc: t(lang, "pagoHotelDesc"),
                      },
                    ]
                  ).map((opt) => {
                    const on = payMode === opt.mode;
                    return (
                      <label
                        key={opt.mode}
                        className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors"
                        style={
                          on
                            ? { borderColor: "var(--brand)", background: "color-mix(in srgb, var(--brand) 7%, white)" }
                            : { borderColor: "#e5e7eb" }
                        }
                      >
                        <input
                          type="radio"
                          name="payMode"
                          checked={on}
                          onChange={() => setPayMode(opt.mode)}
                          className="mt-0.5 accent-[var(--brand)]"
                        />
                        <span>
                          <span className="block text-sm font-bold">{opt.titulo}</span>
                          <span className="block text-xs text-kora-muted">{opt.desc}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Rate plan: Flexible vs No reembolsable (si el hotel la activó y hay prepago) */}
            {reglas.nrfActiva && payMode === "online" && (
              <fieldset className="mt-4">
                <legend className="text-sm font-bold">{t(lang, "eligeTarifa")}</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      {
                        plan: "flex" as RatePlan,
                        titulo: t(lang, "tarifaFlexible"),
                        desc:
                          reglas.cancelacionDias === 0
                            ? t(lang, "tarifaFlexibleDesc0")
                            : t(lang, "tarifaFlexibleDesc", { n: reglas.cancelacionDias }),
                      },
                      {
                        plan: "nrf" as RatePlan,
                        titulo: t(lang, "tarifaNrf"),
                        desc: t(lang, "tarifaNrfDesc", { pct: reglas.nrfPct }),
                      },
                    ]
                  ).map((opt) => {
                    const on = ratePlan === opt.plan;
                    return (
                      <label
                        key={opt.plan}
                        className="flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors"
                        style={
                          on
                            ? { borderColor: "var(--brand)", background: "color-mix(in srgb, var(--brand) 7%, white)" }
                            : { borderColor: "#e5e7eb" }
                        }
                      >
                        <input
                          type="radio"
                          name="ratePlan"
                          checked={on}
                          onChange={() => setRatePlan(opt.plan)}
                          className="mt-0.5 accent-[var(--brand)]"
                        />
                        <span>
                          <span className="block text-sm font-bold">{opt.titulo}</span>
                          <span className="block text-xs text-kora-muted">{opt.desc}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {/* Desglose SIEMPRE visible */}
            <div className="mt-5 rounded-xl border border-gray-100 bg-kora-bg p-4">
              <p className="text-sm font-bold">{t(lang, "desgloseTitulo")}</p>
              <div className="mt-2 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-kora-muted">{t(lang, "subtotal")}</span>
                  <span className="tabular-nums">{formatMXN(subtotal)}</span>
                </div>
                {nrfDiscount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>{t(lang, "descuentoNrf")}</span>
                    <span className="tabular-nums">−{formatMXN(nrfDiscount)}</span>
                  </div>
                )}
                {addonsTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-kora-muted">{t(lang, "extrasLinea")}</span>
                    <span className="tabular-nums">{formatMXN(addonsTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                  <span>{t(lang, "totalEstadia")}</span>
                  <span className="tabular-nums" style={{ color: "var(--brand)" }}>
                    {formatMXN(total)}
                  </span>
                </div>
                {/* Transparencia fiscal: cuánto del total es base, IVA e ISH */}
                <div className="space-y-1 border-t border-dashed border-gray-200 pt-2 text-xs text-kora-muted">
                  <div className="flex justify-between">
                    <span>{t(lang, "tarifaBase")}</span>
                    <span className="tabular-nums">{formatMXN(desglose.base)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t(lang, "iva")}</span>
                    <span className="tabular-nums">{formatMXN(desglose.iva)}</span>
                  </div>
                  {desglose.ishPct > 0 && (
                    <div className="flex justify-between">
                      <span>{t(lang, "ish", { pct: desglose.ishPct })}</span>
                      <span className="tabular-nums">{formatMXN(desglose.ish)}</span>
                    </div>
                  )}
                  <p className="pt-1">{t(lang, "impuestosIncluidos")}</p>
                </div>
                {payMode === "hotel" ? (
                  <p className="flex items-start gap-1.5 border-t border-gray-200 pt-2 text-[12px] text-kora-muted">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} aria-hidden="true" />
                    {t(lang, "pagoHotelHoy", { monto: formatMXN(total) })}
                  </p>
                ) : (
                  isDeposit && (
                    <p className="flex items-start gap-1.5 border-t border-gray-200 pt-2 text-[12px] text-kora-muted">
                      <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} aria-hidden="true" />
                      {t(lang, "pagasAhora", { pct: reglas.anticipoPct, monto: formatMXN(deposit) })}
                    </p>
                  )
                )}
              </div>
            </div>

            {/* Política de cancelación + aceptación */}
            <div className="mt-4 rounded-xl border border-gray-100 p-4">
              <p className="text-sm font-bold">{t(lang, "politicaTitulo")}</p>
              <p className="mt-1 text-sm text-kora-muted">{politicaActiva}</p>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={acepta}
                  onChange={(e) => setAcepta(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                />
                <span className="text-sm font-medium">{t(lang, "aceptoPolitica")}</span>
              </label>
            </div>

            {payError && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {payError}
              </p>
            )}

            <button
              onClick={handlePay}
              disabled={paying}
              className="btn-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              {paying ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t(lang, "procesando")}
                </>
              ) : (
                <>
                  <Lock size={15} aria-hidden="true" />
                  {payMode === "hotel"
                    ? t(lang, "reservarGarantia")
                    : isDeposit
                      ? t(lang, "pagarAnticipo", { monto: formatMXN(deposit), pct: reglas.anticipoPct })
                      : t(lang, "pagarTotal", { monto: formatMXN(total) })}
                </>
              )}
            </button>

            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-kora-muted">
              <ShieldCheck size={12} aria-hidden="true" /> {t(lang, "pagoCifrado")}
              {payMode === "online" && oxxoDisponible && (
                <span> · {t(lang, "pagoOnlineDescOxxo")}</span>
              )}
            </p>
          </section>
        )}

        {/* Pie discreto (se oculta con el premium "Quitar marca Kora") */}
        {!marcaOculta && (
          <footer className="mt-8 text-center">
            <a
              href="https://kora-hotel.com/?utm_source=motor-reservas"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-kora-muted transition-colors hover:text-kora-primary"
            >
              Reservas con <span className="font-bold text-kora-primary">Kora</span>
            </a>
          </footer>
        )}
      </div>
    </div>
  );
}

// ── Contador reutilizable ─────────────────────────────────
function Counter({
  value,
  onDec,
  onInc,
  min,
  decLabel,
  incLabel,
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
  min: number;
  decLabel: string;
  incLabel: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-2 py-1.5">
      <button
        onClick={onDec}
        disabled={value <= min}
        className="grid h-6 w-6 place-items-center rounded-full hover:bg-gray-100 disabled:opacity-40"
        aria-label={decLabel}
      >
        <Minus size={13} />
      </button>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <button
        onClick={onInc}
        className="grid h-6 w-6 place-items-center rounded-full hover:bg-gray-100"
        aria-label={incLabel}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
