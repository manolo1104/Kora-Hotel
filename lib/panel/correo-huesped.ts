// Los datos REALES de un huésped, listos para rellenar una plantilla de correo.
//
// Está separado de la ruta a propósito, igual que `lib/offers.ts`: así se puede
// probar sin auth ni HTTP la parte que de verdad se equivoca —cuál es la
// «próxima» estancia y cuál la «última», y cuánto anticipo falta— sin montar
// media Supabase de mentira.
//
// Ninguna cifra se calcula de nuevo aquí: el anticipo sale de
// `calcDepositAmount`, que es la MISMA función con la que el motor cobra, y la
// política de cancelación de `textoPolitica`, que es la misma que lee el huésped
// al reservar. Si esto tuviera su propia fórmula, el correo diría un número y la
// caja cobraría otro.
//
// SOLO servidor (arrastra tipos del motor y de la base).

import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { bookingRules, calcDepositAmount, politicaDelHotel } from "@/lib/booking";
import { textoPolitica } from "@/lib/politica";
import { hoyHotel } from "@/lib/fecha-hotel";
import type { AdminBooking } from "@/lib/db/admin";
import type { HotelRow } from "@/lib/tenant";
import type { DatosCorreo } from "@/lib/email/plantillas-hotelero";

/** Las reservas VIVAS de ese correo, de la más reciente a la más vieja. */
export function reservasDeHuesped(bookings: AdminBooking[], email: string): AdminBooking[] {
  const clave = (email ?? "").trim().toLowerCase();
  if (!clave) return [];
  return bookings
    .filter((b) => (b.email ?? "").trim().toLowerCase() === clave && reservaCuenta(b.estado))
    .sort((a, b) => b.checkin.localeCompare(a.checkin));
}

export interface ArgsDatosHuesped {
  hotel: HotelRow;
  bookings: AdminBooking[];
  email: string;
  /** Nombre del CRM; si viene vacío se toma el de la reserva más reciente. */
  nombre?: string;
  /** Hoy en la zona del hotel. Se inyecta para poder probarlo. */
  hoy?: string;
}

export function datosDeHuesped({ hotel, bookings, email, nombre, hoy }: ArgsDatosHuesped): DatosCorreo {
  const dia = hoy || hoyHotel();
  const mias = reservasDeHuesped(bookings, email);

  // «Próxima» = la que aún no empieza, la más cercana. Una estancia EN CURSO no
  // cuenta: un correo que dice «tu llegada» a quien ya está en el cuarto es
  // exactamente el tipo de detalle que hace que el hotelero deje de usar esto.
  const proxima = mias.filter((b) => b.checkin >= dia).sort((a, b) => a.checkin.localeCompare(b.checkin))[0];
  // «Última» = la que ya terminó, la más reciente.
  const ultima = mias.filter((b) => b.checkout < dia).sort((a, b) => b.checkout.localeCompare(a.checkout))[0];

  const reglas = bookingRules(hotel);
  const guia = (hotel.guia ?? {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

  const total = proxima?.total ?? 0;
  const pagado = proxima?.anticipo ?? 0;
  // Lo que falta para apartar. Si ya pagó algo, no hay nada que recordarle: se
  // deja en 0 y la plantilla de anticipo se bloquea sola.
  const porPagar =
    proxima && pagado <= 0
      ? calcDepositAmount(total, proxima.noches, {
          pct: reglas.anticipoPct,
          minNights: reglas.anticipoMinNoches,
        })
      : 0;

  return {
    hotelNombre: hotel.nombre || "el hotel",
    huesped: (nombre || proxima?.cliente || ultima?.cliente || "").trim(),
    ubicacion: hotel.ubicacion || undefined,
    checkin: proxima?.checkin,
    checkout: proxima?.checkout,
    noches: proxima?.noches,
    huespedes: proxima?.huespedes,
    habitacion: proxima?.habitaciones,
    confirmacion: proxima?.confirmacion,
    total: total > 0 ? total : undefined,
    anticipoPagado: pagado > 0 ? pagado : undefined,
    anticipoPorPagar: porPagar > 0 ? porPagar : undefined,
    pendiente: total > 0 && pagado > 0 ? Math.max(0, total - pagado) : undefined,
    checkinHora: texto(guia.checkin),
    checkoutHora: texto(guia.checkout),
    politicaCancelacion: textoPolitica(politicaDelHotel(hotel)),
    ultimaEstancia: ultima?.checkout,
    totalReservas: mias.length || undefined,
  };
}
