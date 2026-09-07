// Quién le está escribiendo a Camila.
//
// Hasta hoy: nadie. Camila recibía el teléfono del chat (`body.conv`), lo usaba
// para no duplicar apartados, y NUNCA lo cruzaba con el CRM del hotel. A un
// huésped que ya se hospedó tres veces lo trataba como a un desconocido, y a
// uno que llega pasado mañana le preguntaba en qué fechas quería venir.
//
// Y la pestaña Clientes del panel decía —literalmente— «El bot de WhatsApp lee
// estas notas para personalizar su respuesta». No las leía: `guest_notes` sólo
// la tocaban `buildCRM` y el propio panel. Esto es lo que hace verdad esa frase.
//
// TRES CUIDADOS que no son obvios:
//
//  1. Este bloque es POR CHAT, no por hotel. El runtime cachea el conocimiento
//     del hotel 15 minutos (`agentes/camila/kora.js`), así que meterlo dentro de
//     `systemPrompt` le habría enseñado a un huésped las notas de OTRO. Por eso
//     viaja aparte, en `chat-estado`, y se compone en el runtime en cada turno.
//  2. El nombre, las notas y el cuarto los teclean personas. Van dentro de los
//     delimitadores de DATOS, como el resto de lo que escribe el hotel.
//  3. El aislamiento es el `hotel_id`: las reservas y las notas se piden SIEMPRE
//     para el hotel del token, y el teléfono sólo sirve para buscar dentro.
//
// SOLO servidor.

import { getAllBookings, getGuestNotes } from "@/lib/db/admin";
import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { hoyHotel } from "@/lib/fecha-hotel";
import { fechaLarga, money } from "@/lib/email/design";
import type { AdminBooking } from "@/lib/db/admin";

/** Los últimos 10 dígitos, que es como se compara un teléfono en México. */
export function ultimos10(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "").slice(-10);
}

/** Tope del texto de las notas que llega al prompt. */
const MAX_NOTAS = 400;

export interface DatosBloqueHuesped {
  bookings: AdminBooking[];
  /** email → nota, tal como lo devuelve `getGuestNotes`. */
  notas: Record<string, string>;
  telefono: string;
  hoy: string;
}

/**
 * El bloque de texto que se le añade al prompt, o `""` si no se sabe nada.
 *
 * PURA, para poder probar lo que de verdad se equivoca: a quién reconoce, con
 * qué reserva, y que no se cuele el huésped de otro hotel.
 */
export function bloqueHuesped({ bookings, notas, telefono, hoy }: DatosBloqueHuesped): string {
  const clave = ultimos10(telefono);
  if (clave.length < 10) return "";

  const mias = bookings
    .filter((b) => ultimos10(b.telefono) === clave && reservaCuenta(b.estado))
    .sort((a, b) => a.checkin.localeCompare(b.checkin));
  if (!mias.length) return "";

  const proxima = mias.find((b) => b.checkout >= hoy);
  const pasadas = mias.filter((b) => b.checkout < hoy);
  const ultima = pasadas[pasadas.length - 1];
  const nombre = (proxima?.cliente || ultima?.cliente || "").trim();
  const email = (proxima?.email || ultima?.email || "").trim().toLowerCase();
  const nota = (notas[email] ?? "").trim().slice(0, MAX_NOTAS);

  const lineas: string[] = [];
  if (nombre) lineas.push(`- Se llama ${nombre}.`);
  if (pasadas.length) {
    lineas.push(
      `- Ya se ha hospedado aquí ${pasadas.length} ${pasadas.length === 1 ? "vez" : "veces"}` +
        (ultima ? `, la última terminó el ${fechaLarga(ultima.checkout)}.` : "."),
    );
  }
  if (proxima) {
    const enCasa = proxima.checkin <= hoy;
    const pendiente = Math.max(0, (proxima.total || 0) - (proxima.anticipo || 0));
    lineas.push(
      (enCasa
        ? `- ESTÁ HOSPEDADO AHORA MISMO: ${proxima.habitaciones || "su cuarto"}, sale el ${fechaLarga(proxima.checkout)}`
        : `- Tiene una reserva CONFIRMADA: llega el ${fechaLarga(proxima.checkin)} y sale el ${fechaLarga(proxima.checkout)}, en ${proxima.habitaciones || "su cuarto"}`) +
        (proxima.confirmacion ? ` (folio ${proxima.confirmacion})` : "") +
        ".",
    );
    if (proxima.total > 0) {
      lineas.push(
        pendiente > 0
          ? `- De esa reserva ya pagó ${money(proxima.anticipo || 0)} y le quedan ${money(pendiente)} por liquidar.`
          : `- Esa reserva ya está pagada por completo.`,
      );
    }
  }
  if (nota) lineas.push(`- Notas que el hotel tiene sobre esta persona: ${nota}`);
  if (!lineas.length) return "";

  return [
    "HUÉSPED QUE TE ESCRIBE (esto lo sabemos por su número de teléfono)",
    ...lineas,
    "- Salúdale por su nombre y da por hecho lo que ya sabes: no le vuelvas a preguntar unas fechas que ya tiene reservadas.",
    "- Si te dice que él NO es esa persona, créele y trátale como a alguien nuevo: el teléfono puede haber cambiado de manos.",
  ].join("\n");
}

/**
 * El bloque del huésped que escribe desde `telefono`, en ESTE hotel.
 *
 * Devuelve `""` ante cualquier fallo: saber quién escribe es una mejora, y
 * quedarse callado porque el CRM no respondió sería mucho peor que atender sin
 * reconocer a nadie — que es exactamente lo que Camila lleva haciendo hasta hoy.
 */
export async function contextoHuesped(hotelId: string, telefono: string): Promise<string> {
  if (ultimos10(telefono).length < 10) return "";
  try {
    const [bookings, notas] = await Promise.all([getAllBookings(hotelId), getGuestNotes(hotelId)]);
    return bloqueHuesped({ bookings, notas, telefono, hoy: hoyHotel() });
  } catch (e) {
    console.error("contextoHuesped:", e);
    return "";
  }
}
