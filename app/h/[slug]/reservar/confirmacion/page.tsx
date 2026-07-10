import Link from "next/link";
import {
  CheckCircle,
  Calendar,
  Users,
  BedDouble,
  MessageCircle,
  CalendarPlus,
  MapPin,
  Search,
  Clock,
} from "lucide-react";
import { resolveHotel } from "@/lib/tenant";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { findBookingByPaymentIntent } from "@/lib/db/bookings";
import { formatMXN } from "@/lib/booking";
import { COLOR_DEFAULT, inkFor, fontStack, type MiniExtras } from "@/lib/mini";
import { ownerTienePlanActivo } from "@/lib/suscripcion";
import { t, localeOf, normalizeLang } from "@/lib/booking/i18n";
import { HotelAnalytics } from "@/components/booking/HotelAnalytics";
import { PurchaseTracker } from "@/components/booking/PurchaseTracker";

export const dynamic = "force-dynamic";

function soloDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

interface Resumen {
  folio?: string;
  checkin?: string;
  checkout?: string;
  nights?: string;
  rooms?: string; // "Nombre:2|Otro:1"
  adults?: string;
  children?: string;
  stayTotal?: string;
  depositPaid?: string;
  pending?: string;
  isDeposit?: string;
  anticipoPct?: string;
  ratePlan?: string;
  payMode?: string; // "hotel" = tarjeta como garantía, se paga al llegar
  amountPaid?: number; // de la sesión, en MXN
  customerName?: string;
  paymentStatus?: string; // "unpaid" = voucher OXXO generado pero sin pagar
}

// Link "Agregar a Google Calendar" (evento de día completo, checkout exclusivo).
function googleCalendarUrl(hotelNombre: string, folio: string, checkin: string, checkout: string, ubicacion: string) {
  const d = (s: string) => s.replaceAll("-", "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Reserva · ${hotelNombre}`,
    dates: `${d(checkin)}/${d(checkout)}`,
    details: `Folio: ${folio}`,
    location: ubicacion,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default async function ConfirmacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const { session_id, lang: langParam } = await searchParams;
  const lang = normalizeLang(langParam);

  const hotel = await resolveHotel(slug);
  const hotelNombre = hotel?.nombre ?? "tu hotel";
  const whatsappNum = hotel?.whatsapp ? soloDigitos(hotel.whatsapp) : "";

  // Branding
  const extras = (hotel?.extras ?? {}) as MiniExtras;
  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;
  const ink = inkFor(color);
  const font = fontStack(diseno.fuente);
  const logoUrl = diseno.logoUrl || null;
  const acento = diseno.acento || color;
  const acentoInk = inkFor(acento);
  const marcaOculta =
    !!hotel && extras.premium?.marcaOculta === true && (await ownerTienePlanActivo(hotel.owner_id));

  const fmtFechaLarga = (d?: string): string => {
    if (!d) return "";
    const date = new Date(`${d}T12:00:00`);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString(localeOf(lang), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Recuperar la sesión de Stripe (best-effort; nunca rompe la página).
  let resumen: Resumen | null = null;
  if (session_id && stripeEnvReady) {
    try {
      // Direct charges: la sesión vive en la cuenta conectada del hotel. Se
      // intenta ahí primero y se cae a la cuenta plataforma (sesiones legadas).
      const stripe = getStripe();
      let session;
      if (hotel?.stripe_account_id) {
        session = await stripe.checkout.sessions
          .retrieve(session_id, {}, { stripeAccount: hotel.stripe_account_id })
          .catch(() => null);
      }
      if (!session) session = await stripe.checkout.sessions.retrieve(session_id);
      const md = (session.metadata ?? {}) as Record<string, string>;
      // El folio lo genera el webhook al confirmar el pago: se busca la reserva
      // real por payment_intent (si el webhook aún no corre, se muestra sin folio).
      let folioReal: string | undefined;
      if (hotel) {
        // En modo setup (pago en hotel) la referencia es el setup_intent.
        const pi =
          (typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id) ||
          (typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id) ||
          "";
        if (pi) {
          const booking = await findBookingByPaymentIntent(hotel.id, pi).catch(() => null);
          folioReal = booking?.confirmacion;
        }
      }
      resumen = {
        folio: folioReal || md.folio || undefined,
        checkin: md.checkin,
        checkout: md.checkout,
        nights: md.nights,
        rooms: md.rooms,
        adults: md.adults,
        children: md.children,
        stayTotal: md.stayTotal,
        depositPaid: md.depositPaid,
        pending: md.pending,
        isDeposit: md.isDeposit,
        anticipoPct: md.anticipoPct,
        ratePlan: md.ratePlan,
        payMode: md.payMode,
        amountPaid:
          typeof session.amount_total === "number" ? session.amount_total / 100 : undefined,
        customerName: md.customerName || session.customer_details?.name || undefined,
        paymentStatus: session.payment_status || undefined,
      };
    } catch {
      resumen = null;
    }
  }

  const habitaciones =
    resumen?.rooms
      ?.split("|")
      .map((part) => {
        const [name, guests] = part.split(":");
        return { name: name?.trim() || "", guests: guests?.trim() || "" };
      })
      .filter((r) => r.name) ?? [];

  const isDeposit = resumen?.isDeposit === "true";
  const anticipoPct = Number(resumen?.anticipoPct) || null;
  const pagado =
    resumen?.amountPaid ?? (resumen?.depositPaid ? Number(resumen.depositPaid) : undefined);
  // OXXO: Stripe redirige aquí al GENERAR el voucher, todavía sin pagar. No es
  // honesto decir "Pagado" ni disparar purchase: la reserva se confirma cuando
  // OXXO acredita el pago (webhook async_payment_succeeded).
  const oxxoPendiente = resumen?.payMode !== "hotel" && resumen?.paymentStatus === "unpaid";

  // Ubicación para el mapa y el evento de calendario.
  const ubicacion = (hotel?.ubicacion as string | null) ?? "";
  const mapEmbedUrl = extras.mapEmbedUrl || null;
  const mapsUrl =
    extras.mapsUrl ||
    (ubicacion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotelNombre} ${ubicacion}`)}` : null);

  return (
    <div
      className="min-h-screen w-full bg-kora-bg text-kora-text antialiased"
      style={
        {
          "--brand": color,
          "--brand-ink": ink,
          "--accent": acento,
          "--accent-ink": acentoInk,
          fontFamily: font,
        } as React.CSSProperties
      }
    >
      {/* Medición del hotel + evento purchase (deduplicado por sesión) */}
      <HotelAnalytics
        ga4Id={extras.medicion?.ga4Id || null}
        metaPixelId={extras.medicion?.metaPixelId || null}
      />
      {resumen && resumen.payMode !== "hotel" && !oxxoPendiente && (
        <PurchaseTracker
          txId={resumen.folio || session_id || ""}
          value={pagado ?? 0}
          itemNames={habitaciones.map((h) => h.name)}
        />
      )}

      <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm sm:p-8">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={hotelNombre}
              className="mx-auto mb-4 h-10 w-auto max-w-[180px] object-contain"
            />
          ) : null}
          <div
            className="mx-auto grid h-16 w-16 place-items-center rounded-full"
            style={{
              background: oxxoPendiente
                ? "color-mix(in srgb, #d97706 14%, white)"
                : "color-mix(in srgb, var(--brand) 14%, white)",
            }}
            aria-hidden="true"
          >
            {oxxoPendiente ? (
              <Clock size={36} style={{ color: "#d97706" }} />
            ) : (
              <CheckCircle size={36} style={{ color: "var(--brand)" }} />
            )}
          </div>

          <p
            className="mt-4 text-xs font-semibold uppercase tracking-wide"
            style={{ color: oxxoPendiente ? "#d97706" : "var(--brand)" }}
          >
            {t(lang, oxxoPendiente ? "confOxxoTitulo" : "confTitulo")}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            {t(lang, "confNosVemos", { hotel: hotelNombre })}
          </h1>
          <p className="mt-2 text-sm text-kora-muted">
            {oxxoPendiente
              ? t(lang, "confOxxoDetalle")
              : resumen
                ? t(lang, "confCorreo")
                : t(lang, "confRegistrada")}
          </p>

          {resumen?.folio && (
            <div className="mx-auto mt-5 inline-flex flex-col items-center rounded-xl border border-gray-100 bg-kora-bg px-6 py-3">
              <span className="text-[11px] uppercase tracking-wide text-kora-muted">
                {t(lang, "confFolio")}
              </span>
              <strong className="text-lg tracking-wide" style={{ color: "var(--brand)" }}>
                {resumen.folio}
              </strong>
            </div>
          )}

          {/* Detalle (solo si recuperamos la sesión) */}
          {resumen && (resumen.checkin || habitaciones.length > 0) && (
            <div className="mt-6 space-y-3 text-left">
              {resumen.checkin && (
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} aria-hidden="true" />
                  <div>
                    <span className="block text-[11px] uppercase tracking-wide text-kora-muted">
                      {t(lang, "confCheckin")}
                    </span>
                    <span className="block text-sm font-medium">{fmtFechaLarga(resumen.checkin)}</span>
                  </div>
                </div>
              )}
              {resumen.checkout && (
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} aria-hidden="true" />
                  <div>
                    <span className="block text-[11px] uppercase tracking-wide text-kora-muted">
                      {t(lang, "confCheckout")}
                    </span>
                    <span className="block text-sm font-medium">{fmtFechaLarga(resumen.checkout)}</span>
                  </div>
                </div>
              )}
              {resumen.adults && (
                <div className="flex items-start gap-3">
                  <Users size={16} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} aria-hidden="true" />
                  <div>
                    <span className="block text-[11px] uppercase tracking-wide text-kora-muted">
                      {t(lang, "confHuespedes")}
                    </span>
                    <span className="block text-sm font-medium">
                      {resumen.adults} {resumen.adults === "1" ? t(lang, "adulto") : t(lang, "adultos_pl")}
                      {resumen.children && resumen.children !== "0"
                        ? ` · ${resumen.children} ${t(lang, "menores").toLowerCase()}`
                        : ""}
                    </span>
                  </div>
                </div>
              )}

              {habitaciones.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-kora-bg p-4">
                  {habitaciones.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5 text-sm">
                      <BedDouble size={14} style={{ color: "var(--brand)" }} aria-hidden="true" />
                      <span>
                        {r.name}
                        {r.guests ? ` · ${r.guests}p` : ""}
                      </span>
                    </div>
                  ))}

                  {resumen.ratePlan === "nrf" && (
                    <p className="mt-2 text-xs font-semibold text-kora-muted">
                      {t(lang, "portalTarifa")}: {t(lang, "portalTarifaNrf")}
                    </p>
                  )}

                  {resumen.stayTotal && (
                    <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-sm font-bold">
                      <span>{t(lang, "totalEstadia")}</span>
                      <span className="tabular-nums">{formatMXN(Number(resumen.stayTotal))}</span>
                    </div>
                  )}
                  {resumen.payMode === "hotel" ? (
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="text-kora-muted">{t(lang, "confPagoHotel")}</span>
                      <span className="font-semibold tabular-nums">
                        {formatMXN(Number(resumen.pending ?? resumen.stayTotal ?? 0))}
                      </span>
                    </div>
                  ) : (
                    <>
                      {pagado != null && (
                        <div className="mt-1 flex justify-between text-sm">
                          <span className="text-kora-muted">
                            {oxxoPendiente
                              ? t(lang, "confOxxoPorPagar")
                              : isDeposit && anticipoPct
                                ? t(lang, "confPagadoAnticipo", { pct: anticipoPct })
                                : t(lang, "confPagado")}
                          </span>
                          <span
                            className="font-semibold tabular-nums"
                            style={{ color: oxxoPendiente ? "#d97706" : "var(--brand)" }}
                          >
                            {formatMXN(pagado)}
                          </span>
                        </div>
                      )}
                      {isDeposit && resumen.pending && (
                        <div className="mt-1 flex justify-between text-sm">
                          <span className="text-kora-muted">{t(lang, "confPendiente")}</span>
                          <span className="tabular-nums">{formatMXN(Number(resumen.pending))}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mapa del hotel (si configuró embed o hay dirección) */}
          {mapEmbedUrl ? (
            <div className="mt-6 overflow-hidden rounded-xl border border-gray-100">
              <iframe
                src={mapEmbedUrl}
                title={`${t(lang, "confUbicacion")} — ${hotelNombre}`}
                className="h-44 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          ) : mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: "var(--brand)" }}
            >
              <MapPin size={15} aria-hidden="true" /> {t(lang, "confUbicacion")}
            </a>
          ) : null}

          {/* Acciones */}
          <div className="mt-6 flex flex-col gap-2">
            {resumen?.folio && resumen.checkin && resumen.checkout && (
              <a
                href={googleCalendarUrl(hotelNombre, resumen.folio, resumen.checkin, resumen.checkout, ubicacion)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press inline-flex items-center justify-center gap-2 rounded-full border-2 px-6 py-3 text-sm font-bold"
                style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
              >
                <CalendarPlus size={16} aria-hidden="true" /> {t(lang, "confCalendario")}
              </a>
            )}
            {whatsappNum && (
              <a
                href={`https://wa.me/${whatsappNum}?text=${encodeURIComponent(
                  `Hola, tengo una reserva${resumen?.folio ? ` (${resumen.folio})` : ""} en ${hotelNombre} y quisiera coordinar mi llegada.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                <MessageCircle size={16} aria-hidden="true" /> {t(lang, "confWhatsApp")}
              </a>
            )}
            <Link
              href={`/reserva/consultar${resumen?.folio ? `?folio=${encodeURIComponent(resumen.folio)}` : ""}${lang === "en" ? `${resumen?.folio ? "&" : "?"}lang=en` : ""}`}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-kora-muted transition-colors hover:text-kora-text"
            >
              <Search size={13} aria-hidden="true" /> {t(lang, "confPortal")}
            </Link>
            <Link
              href={`/h/${slug}`}
              className="text-xs text-kora-muted transition-colors hover:text-kora-text"
            >
              {t(lang, "confVolver")}
            </Link>
          </div>
        </div>

        {!marcaOculta && (
          <footer className="mt-6 text-center">
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
