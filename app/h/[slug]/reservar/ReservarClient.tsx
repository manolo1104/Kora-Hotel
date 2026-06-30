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
} from "lucide-react";
import {
  type BookingRoom,
  type CartItem,
  type AddonRule,
  calcRoomStayTotal,
  calcNights,
  calcCartSubtotal,
  calcDepositAmount,
  calcAddonsTotal,
  formatMXN,
} from "@/lib/booking";

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
  addons: AddonRule[];
  reglas: {
    anticipoPct: number;
    anticipoMinNoches: number;
    minNoches: number;
    weekdayDiscount: number;
    weekdayDiscountUntil?: string;
  };
}

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

function soloDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

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
  addons,
  reglas,
}: Props) {
  // ── Fechas + huéspedes ──────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [checkin, setCheckin] = useState(today);
  const [checkout, setCheckout] = useState(tomorrow);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [searchError, setSearchError] = useState("");

  // ── Carrito ─────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  // Extras vendibles seleccionados (por índice en la lista del hotel).
  const [selectedAddons, setSelectedAddons] = useState<number[]>([]);
  function toggleAddon(i: number) {
    setSelectedAddons((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  }

  // ── Flujo de datos del huésped / pago ───────────────────
  const [step, setStep] = useState<"buscar" | "datos">("buscar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const resultsRef = useRef<HTMLDivElement>(null);

  const nights = useMemo(() => calcNights(checkin, checkout), [checkin, checkout]);
  const minCheckout = checkin
    ? new Date(new Date(`${checkin}T12:00:00`).getTime() + 86400000 * reglas.minNoches)
        .toISOString()
        .split("T")[0]
    : tomorrow;

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
    setCart([]);
    setSearchError("");
  }

  function handleCheckinChange(v: string) {
    if (v && v < today) return;
    setCheckin(v);
    if (v) {
      // Garantiza al menos `minNoches` noches entre llegada y salida.
      const minOut = new Date(new Date(`${v}T12:00:00`).getTime() + 86400000 * reglas.minNoches)
        .toISOString()
        .split("T")[0];
      if (!checkout || checkout < minOut) setCheckout(minOut);
    }
    resetSearch();
  }
  function handleCheckoutChange(v: string) {
    setCheckout(v);
    resetSearch();
  }

  // ── Buscar disponibilidad (ruta 1) ─────────────────────
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
      setUnavailable(Array.isArray(data?.unavailableRooms) ? data.unavailableRooms : []);
    } catch {
      setUnavailable([]);
      setSearchError("No pudimos verificar disponibilidad. Intenta de nuevo.");
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
    }),
    [reglas.weekdayDiscount, reglas.weekdayDiscountUntil],
  );
  const subtotal = useMemo(
    () => calcCartSubtotal(rooms, cart, checkin, checkout, priceOpts),
    [rooms, cart, checkin, checkout, priceOpts],
  );
  const addonsTotal = useMemo(
    () => calcAddonsTotal(addons, selectedAddons, nights, adults),
    [addons, selectedAddons, nights, adults],
  );
  const total = subtotal + addonsTotal;
  const deposit = useMemo(
    () =>
      calcDepositAmount(total, nights, {
        pct: reglas.anticipoPct,
        minNights: reglas.anticipoMinNoches,
      }),
    [total, nights, reglas.anticipoPct, reglas.anticipoMinNoches],
  );
  const isDeposit = deposit < total;

  const cartHasUnavailable = cart.some((item) => {
    const room = findRoom(item.roomId);
    return room && unavailable.includes(room.name);
  });
  const cartCapacity = cart.reduce((s, item) => s + (findRoom(item.roomId)?.maxGuests ?? 0), 0);
  const capacityOk = cart.length === 0 || cartCapacity >= adults;
  const canContinue =
    cart.length > 0 && checkin && checkout && nights > 0 && !cartHasUnavailable && capacityOk;

  // ── Pagar / reservar (ruta 2) ──────────────────────────
  async function handlePay() {
    if (!canContinue) return;
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setPayError("Completa nombre, correo y teléfono.");
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
        setSearchError("Algunas habitaciones se ocuparon. Ajusta tu selección e intenta de nuevo.");
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
        return;
      }

      const data = await res.json().catch(() => ({}));

      // Éxito con Stripe → redirige al checkout hospedado.
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }

      // Sin Stripe configurado → flujo WhatsApp.
      if (data?.whatsapp) {
        const num = soloDigitos((data.whatsappNumber as string) || whatsapp || "");
        const stay = typeof data.stayTotal === "number" ? data.stayTotal : subtotal;
        const dep = typeof data.deposit === "number" ? data.deposit : deposit;
        const roomLines = cart
          .map((item) => {
            const room = findRoom(item.roomId)!;
            const t = calcRoomStayTotal(room, item.guestCount, checkin, checkout);
            return `• ${room.name} (${item.guestCount} persona${item.guestCount > 1 ? "s" : ""}) — ${formatMXN(t)}`;
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
          setPayError("Este hotel aún no tiene pago en línea ni WhatsApp configurado.");
          setPaying(false);
        }
        return;
      }

      // Otros errores
      setPayError(typeof data?.error === "string" ? errorEs(data.error) : "No se pudo iniciar el pago. Intenta de nuevo.");
      setPaying(false);
    } catch {
      setPayError("Error de conexión. Verifica tu internet e intenta de nuevo.");
      setPaying(false);
    }
  }

  function errorEs(code: string): string {
    if (code === "hotel-no-encontrado") return "Hotel no encontrado.";
    if (code === "no-disponible") return "Las fechas ya no están disponibles.";
    return code;
  }

  // Si se vacía el carrito estando en el paso de datos, regresa a buscar.
  useEffect(() => {
    if (step === "datos" && cart.length === 0) setStep("buscar");
  }, [cart.length, step]);

  const fmtFecha = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

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
        {/* Encabezado: portada con foto del hotel, o cabecera de texto */}
        {coverUrl ? (
          <header className="mb-5 overflow-hidden rounded-2xl">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt={hotelNombre} className="h-44 w-full object-cover sm:h-52" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/90">
                  Reserva directa · Sin comisiones
                </p>
                <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {hotelNombre}
                </h1>
                <p className="mt-0.5 text-sm text-white/85">
                  Confirmación inmediata · Pago seguro · Mejor precio garantizado
                </p>
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
              Reserva directa · Sin comisiones
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{hotelNombre}</h1>
            <p className="mt-1 text-sm text-kora-muted">
              Confirmación inmediata · Pago seguro · Mejor precio garantizado
            </p>
          </header>
        )}

        {step === "buscar" ? (
          <>
            {/* ── Barra de búsqueda ── */}
            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-kora-muted">Llegada</span>
                  <input
                    type="date"
                    value={checkin}
                    min={today}
                    onChange={(e) => handleCheckinChange(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-kora-muted">Salida</span>
                  <input
                    type="date"
                    value={checkout}
                    min={minCheckout}
                    onChange={(e) => handleCheckoutChange(e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-kora-muted">Adultos</span>
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
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-kora-muted">Menores</span>
                  <Counter
                    value={children}
                    onDec={() => setChildren((c) => Math.max(0, c - 1))}
                    onInc={() => setChildren((c) => Math.min(20, c + 1))}
                    min={0}
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
                    <Loader2 size={16} className="animate-spin" /> Verificando…
                  </>
                ) : searched ? (
                  "Actualizar disponibilidad"
                ) : (
                  "Ver disponibilidad"
                )}
              </button>

              {nights > 0 && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-kora-muted">
                  <CalendarDays size={13} />
                  {nights} noche{nights !== 1 ? "s" : ""} · {fmtFecha(checkin)} → {fmtFecha(checkout)}
                </p>
              )}
              {searchError && (
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {searchError}
                </p>
              )}
            </section>

            {/* ── Grid de cuartos ── */}
            <div ref={resultsRef} className="mt-6">
              {!searched && !searching && (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-5 text-sm text-kora-muted">
                  <CalendarDays size={18} style={{ color: "var(--brand)" }} />
                  <span>
                    Elige tus fechas y toca <strong>Ver disponibilidad</strong> para ver precios reales.
                  </span>
                </div>
              )}

              {searching && (
                <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-5 text-sm text-kora-muted">
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--brand)" }} />
                  Consultando disponibilidad en tiempo real…
                </div>
              )}

              {searched && !searching && rooms.length === 0 && (
                <p className="rounded-xl border border-gray-100 bg-white px-4 py-5 text-sm text-kora-muted">
                  Este hotel aún no tiene habitaciones cargadas.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {rooms.map((room) => {
                  const unavail = isUnavailable(room);
                  const added = inCart(room.id);
                  const guests = getRoomGuests(room);
                  const total = searched ? calcRoomStayTotal(room, guests, checkin, checkout) : null;
                  const img = room.image || room.images?.[0];
                  return (
                    <article
                      key={room.id}
                      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
                        added ? "border-[var(--brand)]" : "border-gray-100"
                      } ${unavail ? "opacity-70" : ""}`}
                    >
                      <div className="relative h-40 w-full">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={room.name} className="h-full w-full object-cover" />
                        ) : (
                          <RoomPlaceholder name={room.name} />
                        )}
                        {unavail && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/55 text-white">
                            <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                              <Ban size={14} /> No disponible
                            </span>
                            <span className="text-[11px] opacity-90">Agotada en estas fechas</span>
                          </div>
                        )}
                        {added && !unavail && (
                          <div
                            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                          >
                            <Check size={12} /> Agregada
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h3 className="font-bold leading-tight">{room.name}</h3>
                        {room.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-kora-muted">{room.description}</p>
                        )}
                        <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-kora-muted">
                          <Users size={12} /> Hasta {room.maxGuests} personas
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
                              {searched && total !== null ? formatMXN(total) : formatMXN(room.price)}
                            </span>
                            <span className="block text-[11px] text-kora-muted">
                              {searched && total !== null
                                ? `total · ${nights} noche${nights !== 1 ? "s" : ""} · ${guests} pax`
                                : "por noche"}
                            </span>
                          </div>

                          {unavail ? (
                            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-kora-muted">
                              Agotada
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
                                  <X size={12} /> Quitar
                                </>
                              ) : (
                                "Seleccionar"
                              )}
                            </button>
                          ) : (
                            <span className="text-[11px] text-kora-muted">Busca fechas</span>
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
                <h2 className="text-base font-bold">Tu reserva</h2>

                <div className="mt-3 space-y-3">
                  {cart.map((item) => {
                    const room = findRoom(item.roomId)!;
                    const t = calcRoomStayTotal(room, item.guestCount, checkin, checkout);
                    const unav = unavailable.includes(room.name);
                    return (
                      <div key={item.roomId} className="rounded-xl border border-gray-100 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold">{room.name}</span>
                          <button
                            onClick={() => removeFromCart(item.roomId)}
                            aria-label="Quitar"
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
                              aria-label="Menos adultos"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="tabular-nums">
                              {item.guestCount} adulto{item.guestCount !== 1 ? "s" : ""}
                            </span>
                            <button
                              onClick={() => updateGuests(item.roomId, 1)}
                              disabled={item.guestCount >= room.maxGuests}
                              className="grid h-7 w-7 place-items-center rounded-full border border-gray-200 disabled:opacity-40"
                              aria-label="Más adultos"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                          <span className="font-semibold tabular-nums">{formatMXN(t)}</span>
                        </div>
                        {unav && (
                          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-amber-700">
                            <AlertTriangle size={12} /> Ya no disponible para estas fechas
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!capacityOk && (
                  <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    {adults} adultos pero la capacidad seleccionada es {cartCapacity}. Agrega otra habitación.
                  </p>
                )}

                {addons.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-sm font-bold">¿Quieres agregar algo?</p>
                    <div className="mt-2 space-y-2">
                      {addons.map((a, i) => {
                        const on = selectedAddons.includes(i);
                        const unit =
                          a.tipo === "noche"
                            ? `${formatMXN(a.precio)} / noche`
                            : a.tipo === "persona"
                              ? `${formatMXN(a.precio)} / persona`
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
                                {on && <Check size={13} style={{ color: "var(--brand-ink)" }} />}
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
                    <span className="text-kora-muted">Subtotal</span>
                    <span className="tabular-nums">{formatMXN(subtotal)}</span>
                  </div>
                  {addonsTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-kora-muted">Extras</span>
                      <span className="tabular-nums">{formatMXN(addonsTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold">
                    <span>Total estadía</span>
                    <span className="tabular-nums" style={{ color: "var(--brand)" }}>
                      {formatMXN(total)}
                    </span>
                  </div>
                  {isDeposit && (
                    <p className="flex items-start gap-1.5 pt-1 text-[12px] text-kora-muted">
                      <ShieldCheck size={13} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} />
                      Pagas ahora el {reglas.anticipoPct}% ({formatMXN(deposit)}). El resto al llegar.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (!canContinue) return;
                    setPayError("");
                    setStep("datos");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  disabled={!canContinue}
                  className="btn-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  Continuar <ChevronRight size={16} />
                </button>

                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-kora-muted">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={12} /> Pago seguro
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck size={12} /> Confirmación inmediata
                  </span>
                </div>
              </section>
            )}
          </>
        ) : (
          /* ── Paso 2: datos del huésped ── */
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <button
              onClick={() => setStep("buscar")}
              className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-kora-muted hover:text-kora-text"
            >
              <ChevronLeft size={15} /> Volver
            </button>

            <h2 className="text-lg font-bold">Datos del huésped</h2>
            <p className="mt-1 text-sm text-kora-muted">Necesitamos estos datos para confirmar tu reserva.</p>

            <div className="mt-4 grid gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-kora-muted">Nombre completo *</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  autoComplete="name"
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-kora-muted">Correo electrónico *</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-kora-muted">Teléfono / WhatsApp *</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+52 ..."
                  autoComplete="tel"
                  className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--brand)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                />
              </label>
            </div>

            {/* Resumen compacto */}
            <div className="mt-5 rounded-xl border border-gray-100 bg-kora-bg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-kora-muted">
                  <CalendarDays size={14} /> {fmtFecha(checkin)} → {fmtFecha(checkout)} · {nights} noche
                  {nights !== 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1.5 text-kora-muted">
                  <Users size={14} /> {adults} adulto{adults !== 1 ? "s" : ""}
                  {children > 0 ? ` · ${children} menor${children !== 1 ? "es" : ""}` : ""}
                </span>
              </div>
              <div className="mt-3 space-y-1.5">
                {cart.map((item) => {
                  const room = findRoom(item.roomId)!;
                  const t = calcRoomStayTotal(room, item.guestCount, checkin, checkout);
                  return (
                    <div key={item.roomId} className="flex justify-between text-sm">
                      <span>
                        {room.name} · {item.guestCount}p
                      </span>
                      <span className="tabular-nums">{formatMXN(t)}</span>
                    </div>
                  );
                })}
                {selectedAddons.map((i) => {
                  const a = addons[i];
                  if (!a) return null;
                  const t =
                    a.tipo === "noche"
                      ? a.precio * Math.max(1, nights)
                      : a.tipo === "persona"
                        ? a.precio * Math.max(1, adults)
                        : a.precio;
                  return (
                    <div key={`a-${i}`} className="flex justify-between text-sm text-kora-muted">
                      <span>+ {a.nombre}</span>
                      <span className="tabular-nums">{formatMXN(t)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-base font-bold">
                <span>Total estadía</span>
                <span className="tabular-nums" style={{ color: "var(--brand)" }}>
                  {formatMXN(total)}
                </span>
              </div>
              {isDeposit && (
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-kora-muted">Pagas ahora ({reglas.anticipoPct}%)</span>
                  <span className="font-semibold tabular-nums">{formatMXN(deposit)}</span>
                </div>
              )}
            </div>

            {payError && (
              <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {payError}
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
                  <Loader2 size={16} className="animate-spin" /> Procesando…
                </>
              ) : (
                <>
                  <Lock size={15} />
                  {isDeposit
                    ? `Pagar ${formatMXN(deposit)} — Anticipo ${reglas.anticipoPct}%`
                    : `Pagar ${formatMXN(total)} — Confirmar`}
                </>
              )}
            </button>

            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-kora-muted">
              <ShieldCheck size={12} /> Pago cifrado. Nunca almacenamos datos de tarjeta.
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
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
  min: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-2 py-1.5">
      <button
        onClick={onDec}
        disabled={value <= min}
        className="grid h-6 w-6 place-items-center rounded-full hover:bg-gray-100 disabled:opacity-40"
        aria-label="Menos"
      >
        <Minus size={13} />
      </button>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <button
        onClick={onInc}
        className="grid h-6 w-6 place-items-center rounded-full hover:bg-gray-100"
        aria-label="Más"
      >
        <Plus size={13} />
      </button>
    </div>
  );
}
