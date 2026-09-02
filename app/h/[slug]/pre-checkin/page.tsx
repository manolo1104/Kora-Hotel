import type { Metadata } from "next";
import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { resolveHotel } from "@/lib/tenant";
import { getBooking } from "@/lib/db/bookings";
import { tienePreCheckin } from "@/lib/db/pre-checkin";
import { COLOR_DEFAULT, inkFor, fontStack, type MiniExtras } from "@/lib/mini";
import { hoyHotel } from "@/lib/fecha-hotel";
import { PreCheckinForm } from "./PreCheckinForm";
import { BuscarReserva } from "./BuscarReserva";

export const dynamic = "force-dynamic";

// Pre check-in del huésped, desde su celular y sin cuenta.
//
// DOS PUERTAS, las dos que pidió el hotelero:
//   1. `?r=<uuid de la reserva>` — el enlace del correo y el QR que recepción
//      enseña en pantalla. Entra directo a su formulario.
//   2. Sin `r` — el QR fijo pegado en el mostrador, para quien no hizo el pre
//      check-in. Pide folio + apellido, como el portal del huésped ya hace con
//      folio + correo.
//
// Cuelga de `app/h/[slug]/` a propósito: hereda de su layout el corte cuando
// Kora bloquea la cuenta de un hotel.
export const metadata: Metadata = {
  // Registro personal atado a una reserva: no tiene nada que hacer en Google.
  robots: { index: false, follow: false },
};

interface BookingLite {
  id: string;
  confirmacion: string | null;
  cliente: string | null;
  checkin: string | null;
  checkout: string | null;
  habitaciones: string | null;
  huespedes: number | null;
  estado: string | null;
}

export default async function PreCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string; qr?: string }>;
}) {
  const { slug } = await params;
  const { r, qr } = await searchParams;

  const hotel = await resolveHotel(slug);

  const extras = (hotel?.extras ?? {}) as MiniExtras & Record<string, unknown>;
  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;
  const ink = inkFor(color);
  const font = fontStack(diseno.fuente);

  const shell = (contenido: React.ReactNode) => (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={
        {
          "--brand": color,
          "--brand-ink": ink,
          fontFamily: font,
          background: "color-mix(in srgb, var(--brand) 6%, #f8fafc)",
        } as React.CSSProperties
      }
    >
      <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-xl ring-1 ring-black/5">
        {contenido}
      </div>
    </main>
  );

  if (!hotel) {
    return shell(<p className="text-center text-sm text-gray-600">No encontramos este hotel.</p>);
  }

  // ── Puerta 2: el QR del mostrador, sin reserva en el enlace ───────────────
  if (!r) {
    return shell(<BuscarReserva slug={slug} hotelNombre={hotel.nombre ?? ""} />);
  }

  // ── Puerta 1: el enlace del correo o el QR de la reserva ──────────────────
  const booking = (await getBooking(hotel.id, r)) as BookingLite | null;

  // Un ÚNICO mensaje para "no existe", "no es de este hotel", "está cancelada" y
  // "ya pasó": distinguirlos le confirmaría a un curioso que un uuid es real.
  const enlaceMuerto = shell(
    <div className="text-center">
      <p className="text-sm text-gray-600">
        Este enlace ya no es válido. Escríbele al hotel y te ayudan a registrarte.
      </p>
    </div>,
  );

  if (!booking || !reservaCuenta(booking.estado)) return enlaceMuerto;
  if (booking.checkout && booking.checkout < hoyHotel()) return enlaceMuerto;

  // Ya se registró. NO se le vuelven a enseñar sus datos: quien tenga el enlace
  // podría leerlos. Se confirma el hecho y se ofrece rehacerlo en blanco.
  const yaRegistrado = await tienePreCheckin(hotel.id, booking.id);

  return shell(
    <PreCheckinForm
      slug={slug}
      r={booking.id}
      hotelNombre={hotel.nombre ?? ""}
      clienteName={(booking.cliente ?? "").trim()}
      confirmacion={booking.confirmacion ?? ""}
      checkin={booking.checkin ?? ""}
      checkout={booking.checkout ?? ""}
      habitaciones={booking.habitaciones ?? ""}
      huespedes={booking.huespedes ?? 1}
      yaRegistrado={yaRegistrado}
      origen={qr === "1" ? "qr_reserva" : "correo"}
    />,
  );
}
