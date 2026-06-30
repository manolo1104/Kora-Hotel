import Link from "next/link";
import { CheckCircle, Calendar, Users, BedDouble, MessageCircle } from "lucide-react";
import { resolveHotel } from "@/lib/tenant";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";
import { formatMXN } from "@/lib/booking";
import { COLOR_DEFAULT, inkFor, fontStack, type MiniExtras } from "@/lib/mini";
import { ownerTienePlanActivo } from "@/lib/suscripcion";

export const dynamic = "force-dynamic";

function fmtFechaLarga(d?: string): string {
  if (!d) return "";
  const date = new Date(`${d}T12:00:00`);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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
  amountPaid?: number; // de la sesión, en MXN
  customerName?: string;
}

export default async function ConfirmacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;

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
  const marcaOculta =
    !!hotel && extras.premium?.marcaOculta === true && (await ownerTienePlanActivo(hotel.owner_id));

  // Recuperar la sesión de Stripe (best-effort; nunca rompe la página).
  let resumen: Resumen | null = null;
  if (session_id && stripeEnvReady) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id);
      const md = (session.metadata ?? {}) as Record<string, string>;
      resumen = {
        folio: md.folio || md.confirmationNumber || undefined,
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
        amountPaid:
          typeof session.amount_total === "number" ? session.amount_total / 100 : undefined,
        customerName: md.customerName || session.customer_details?.name || undefined,
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
  const pagado =
    resumen?.amountPaid ?? (resumen?.depositPaid ? Number(resumen.depositPaid) : undefined);

  return (
    <div
      className="min-h-screen w-full bg-kora-bg text-kora-text antialiased"
      style={
        {
          "--brand": color,
          "--brand-ink": ink,
          fontFamily: font,
        } as React.CSSProperties
      }
    >
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
            style={{ background: "color-mix(in srgb, var(--brand) 14%, white)" }}
            aria-hidden="true"
          >
            <CheckCircle size={36} style={{ color: "var(--brand)" }} />
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--brand)" }}>
            ¡Reserva confirmada!
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Nos vemos en {hotelNombre}</h1>
          <p className="mt-2 text-sm text-kora-muted">
            {resumen
              ? "Recibirás un correo de confirmación en los próximos minutos."
              : "¡Gracias! Tu solicitud quedó registrada. Te contactaremos para confirmar los detalles."}
          </p>

          {resumen?.folio && (
            <div className="mx-auto mt-5 inline-flex flex-col items-center rounded-xl border border-gray-100 bg-kora-bg px-6 py-3">
              <span className="text-[11px] uppercase tracking-wide text-kora-muted">
                Número de confirmación
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
                  <Calendar size={16} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} />
                  <div>
                    <span className="block text-[11px] uppercase tracking-wide text-kora-muted">Check-in</span>
                    <span className="block text-sm font-medium">{fmtFechaLarga(resumen.checkin)}</span>
                  </div>
                </div>
              )}
              {resumen.checkout && (
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} />
                  <div>
                    <span className="block text-[11px] uppercase tracking-wide text-kora-muted">Check-out</span>
                    <span className="block text-sm font-medium">{fmtFechaLarga(resumen.checkout)}</span>
                  </div>
                </div>
              )}
              {resumen.adults && (
                <div className="flex items-start gap-3">
                  <Users size={16} className="mt-0.5 shrink-0" style={{ color: "var(--brand)" }} />
                  <div>
                    <span className="block text-[11px] uppercase tracking-wide text-kora-muted">Huéspedes</span>
                    <span className="block text-sm font-medium">
                      {resumen.adults} adulto{resumen.adults !== "1" ? "s" : ""}
                      {resumen.children && resumen.children !== "0" ? ` · ${resumen.children} menores` : ""}
                    </span>
                  </div>
                </div>
              )}

              {habitaciones.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-kora-bg p-4">
                  {habitaciones.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5 text-sm">
                      <BedDouble size={14} style={{ color: "var(--brand)" }} />
                      <span>
                        {r.name}
                        {r.guests ? ` · ${r.guests}p` : ""}
                      </span>
                    </div>
                  ))}

                  {resumen.stayTotal && (
                    <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-sm font-bold">
                      <span>Total estadía</span>
                      <span className="tabular-nums">{formatMXN(Number(resumen.stayTotal))}</span>
                    </div>
                  )}
                  {pagado != null && (
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="text-kora-muted">{isDeposit ? "Pagado (50%)" : "Pagado"}</span>
                      <span className="font-semibold tabular-nums" style={{ color: "var(--brand)" }}>
                        {formatMXN(pagado)}
                      </span>
                    </div>
                  )}
                  {isDeposit && resumen.pending && (
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="text-kora-muted">Pendiente al check-in</span>
                      <span className="tabular-nums">{formatMXN(Number(resumen.pending))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Acciones */}
          <div className="mt-6 flex flex-col gap-2">
            {whatsappNum && (
              <a
                href={`https://wa.me/${whatsappNum}?text=${encodeURIComponent(
                  `Hola, tengo una reserva${resumen?.folio ? ` (${resumen.folio})` : ""} en ${hotelNombre} y quisiera coordinar mi llegada.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-press inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold"
                style={{ background: "var(--brand)", color: "var(--brand-ink)" }}
              >
                <MessageCircle size={16} /> Coordinar llegada por WhatsApp
              </a>
            )}
            <Link
              href={`/h/${slug}`}
              className="text-xs text-kora-muted transition-colors hover:text-kora-text"
            >
              ← Volver a la página del hotel
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
