"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Users,
  BedDouble,
  MessageCircle,
  MailCheck,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { formatMXN } from "@/lib/booking";
import { t, localeOf, normalizeLang, LANG_KEY, type Lang } from "@/lib/booking/i18n";

interface PortalBooking {
  folio: string;
  cliente: string | null;
  checkin: string;
  checkout: string;
  noches: number;
  huespedes: number;
  habitaciones: string;
  total: number;
  anticipo: number;
  estado: string;
  ratePlan: "flex" | "nrf";
  hotel: { nombre: string; slug: string; whatsapp: string | null };
  cancelable: boolean;
  motivoNoCancelable: "nrf" | "plazo" | "estado" | null;
  fechaLimite: string;
  politicaCancelacion: string | null;
}

function soloDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export default function ConsultarClient() {
  const [lang, setLang] = useState<Lang>("es");
  const [folio, setFolio] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<PortalBooking | null>(null);

  const [confirmandoCancel, setConfirmandoCancel] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelada, setCancelada] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenvioMsg, setReenvioMsg] = useState<"ok" | "error" | "">("");

  // Prefill desde la URL (?folio=…&lang=…) + idioma recordado.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const f = sp.get("folio");
      if (f) setFolio(f);
      const q = sp.get("lang");
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

  const fmtFecha = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString(localeOf(lang), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (!folio.trim() || !email.trim()) return;
    setLoading(true);
    setError("");
    setBooking(null);
    setCancelada(false);
    setReenvioMsg("");
    setConfirmandoCancel(false);
    try {
      const res = await fetch("/api/reserva/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folio: folio.trim(), email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.booking) {
        setBooking(data.booking as PortalBooking);
      } else {
        setError(res.status === 404 ? t(lang, "portalNoEncontrada") : t(lang, "portalError"));
      }
    } catch {
      setError(t(lang, "errConexion"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelar() {
    if (!booking) return;
    setCancelando(true);
    setError("");
    try {
      const res = await fetch("/api/reserva/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folio: folio.trim(), email: email.trim(), confirmar: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.booking) {
        setBooking(data.booking as PortalBooking);
        setCancelada(true);
        setConfirmandoCancel(false);
      } else {
        setError(t(lang, "portalError"));
      }
    } catch {
      setError(t(lang, "errConexion"));
    } finally {
      setCancelando(false);
    }
  }

  async function handleReenviar() {
    setReenviando(true);
    setReenvioMsg("");
    try {
      const res = await fetch("/api/reserva/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folio: folio.trim(), email: email.trim() }),
      });
      setReenvioMsg(res.ok ? "ok" : "error");
    } catch {
      setReenvioMsg("error");
    } finally {
      setReenviando(false);
    }
  }

  const saldo = booking ? Math.max(0, booking.total - booking.anticipo) : 0;
  const estaConfirmada = booking?.estado === "CONFIRMADA" || booking?.estado === "MANUAL";

  return (
    <div className="min-h-screen w-full bg-kora-bg text-kora-text antialiased">
      <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        {/* Toggle de idioma */}
        <div className="mb-3 flex justify-end">
          <div
            className="inline-flex overflow-hidden rounded-full border border-gray-200 bg-white text-xs font-bold"
            role="group"
            aria-label="Idioma / Language"
          >
            {(["es", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => switchLang(l)}
                aria-pressed={lang === l}
                className={`px-3 py-1.5 uppercase transition-colors ${
                  lang === l ? "bg-kora-primary text-white" : ""
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">{t(lang, "portalTitulo")}</h1>
          <p className="mt-1 text-sm text-kora-muted">{t(lang, "portalSub")}</p>

          <form onSubmit={handleBuscar} className="mt-5 grid gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-kora-muted">{t(lang, "portalFolio")}</span>
              <input
                type="text"
                value={folio}
                onChange={(e) => setFolio(e.target.value.toUpperCase())}
                placeholder="PE-2026-3F9K"
                autoComplete="off"
                className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm uppercase tracking-wide focus:border-kora-primary focus:outline-none focus:ring-1 focus:ring-kora-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-kora-muted">{t(lang, "correoLabel").replace(" *", "")}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t(lang, "correoPlaceholder")}
                autoComplete="email"
                inputMode="email"
                className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-kora-primary focus:outline-none focus:ring-1 focus:ring-kora-primary"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !folio.trim() || !email.trim()}
              className="btn-press mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full bg-kora-primary px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t(lang, "portalBuscando")}
                </>
              ) : (
                <>
                  <Search size={15} aria-hidden="true" /> {t(lang, "portalBuscar")}
                </>
              )}
            </button>
          </form>

          {error && (
            <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}

          {/* Detalle de la reserva */}
          {booking && (
            <div className="mt-6 border-t border-gray-100 pt-5" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-kora-muted">{booking.hotel.nombre}</p>
                  <p className="text-lg font-extrabold tracking-wide text-kora-primary">{booking.folio}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                    estaConfirmada ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {estaConfirmada ? (
                    <>
                      <CheckCircle size={12} aria-hidden="true" /> {t(lang, "portalEstadoConfirmada")}
                    </>
                  ) : (
                    <>
                      <XCircle size={12} aria-hidden="true" /> {t(lang, "portalEstadoCancelada")}
                    </>
                  )}
                </span>
              </div>

              {cancelada && (
                <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {t(lang, "portalCancelada")}
                </p>
              )}

              <div className="mt-4 space-y-2.5 text-sm">
                <p className="flex items-center gap-2">
                  <CalendarDays size={15} className="shrink-0 text-kora-primary" aria-hidden="true" />
                  {fmtFecha(booking.checkin)} → {fmtFecha(booking.checkout)}
                </p>
                <p className="flex items-center gap-2">
                  <Users size={15} className="shrink-0 text-kora-primary" aria-hidden="true" />
                  {booking.huespedes} {booking.huespedes === 1 ? t(lang, "adulto") : t(lang, "adultos_pl")} ·{" "}
                  {booking.noches} {lang === "en" ? (booking.noches === 1 ? "night" : "nights") : booking.noches === 1 ? "noche" : "noches"}
                </p>
                <p className="flex items-center gap-2">
                  <BedDouble size={15} className="shrink-0 text-kora-primary" aria-hidden="true" />
                  {booking.habitaciones}
                </p>
              </div>

              <div className="mt-4 space-y-1.5 rounded-xl border border-gray-100 bg-kora-bg p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-kora-muted">{t(lang, "portalTarifa")}</span>
                  <span className="font-semibold">
                    {booking.ratePlan === "nrf" ? t(lang, "portalTarifaNrf") : t(lang, "portalTarifaFlex")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-kora-muted">{t(lang, "portalTotal")}</span>
                  <span className="font-bold tabular-nums">{formatMXN(booking.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-kora-muted">{t(lang, "portalAnticipo")}</span>
                  <span className="tabular-nums">{formatMXN(booking.anticipo)}</span>
                </div>
                {saldo > 0 && (
                  <div className="flex justify-between">
                    <span className="text-kora-muted">{t(lang, "portalSaldo")}</span>
                    <span className="tabular-nums">{formatMXN(saldo)}</span>
                  </div>
                )}
              </div>

              {booking.politicaCancelacion && (
                <p className="mt-3 text-xs text-kora-muted">
                  <strong>{t(lang, "politicaTitulo")}:</strong> {booking.politicaCancelacion}
                </p>
              )}

              {/* Cancelación */}
              {estaConfirmada && (
                <div className="mt-5 space-y-2">
                  {booking.cancelable ? (
                    <>
                      <p className="text-xs text-kora-muted">
                        {t(lang, "portalPlazo", { fecha: fmtFecha(booking.fechaLimite) })}
                      </p>
                      {!confirmandoCancel ? (
                        <button
                          type="button"
                          onClick={() => setConfirmandoCancel(true)}
                          className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-red-600 px-6 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"
                        >
                          {t(lang, "portalCancelarBtn")}
                        </button>
                      ) : (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                          <p className="text-sm font-semibold text-red-800">
                            {t(lang, "portalCancelarConfirma")}
                          </p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={handleCancelar}
                              disabled={cancelando}
                              className="btn-press inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                            >
                              {cancelando ? (
                                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                              ) : null}
                              {t(lang, "portalCancelarSi")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoCancel(false)}
                              className="btn-press inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold"
                            >
                              {t(lang, "portalCancelarNo")}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : booking.motivoNoCancelable === "nrf" ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {t(lang, "portalNoCancelableNrf")}
                    </p>
                  ) : booking.motivoNoCancelable === "plazo" ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {t(lang, "portalNoCancelablePlazo", { fecha: fmtFecha(booking.fechaLimite) })}
                    </p>
                  ) : null}
                </div>
              )}

              {/* Reenviar confirmación + WhatsApp del hotel */}
              <div className="mt-3 flex flex-col gap-2">
                {estaConfirmada && (
                  <button
                    type="button"
                    onClick={handleReenviar}
                    disabled={reenviando}
                    className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-kora-primary px-6 py-2.5 text-sm font-bold text-kora-primary hover:bg-kora-primary/5 disabled:opacity-60"
                  >
                    {reenviando ? (
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <MailCheck size={15} aria-hidden="true" />
                    )}
                    {t(lang, "portalReenviar")}
                  </button>
                )}
                {reenvioMsg === "ok" && (
                  <p className="text-center text-xs font-semibold text-emerald-700">{t(lang, "portalReenviada")}</p>
                )}
                {reenvioMsg === "error" && (
                  <p className="text-center text-xs font-semibold text-red-700">{t(lang, "portalReenviarError")}</p>
                )}
                {booking.hotel.whatsapp && (
                  <a
                    href={`https://wa.me/${soloDigitos(booking.hotel.whatsapp)}?text=${encodeURIComponent(
                      `Hola, tengo la reserva ${booking.folio} en ${booking.hotel.nombre}.`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-press inline-flex w-full items-center justify-center gap-2 rounded-full bg-kora-primary px-6 py-2.5 text-sm font-bold text-white"
                  >
                    <MessageCircle size={15} aria-hidden="true" /> WhatsApp · {booking.hotel.nombre}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setBooking(null);
                    setFolio("");
                    setError("");
                    setCancelada(false);
                    setReenvioMsg("");
                  }}
                  className="text-xs text-kora-muted transition-colors hover:text-kora-text"
                >
                  {t(lang, "portalOtra")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
