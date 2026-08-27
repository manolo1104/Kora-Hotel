// La lista de correo de Kora: quién está, qué se le manda y cuándo.
//
// Fuente única compartida por /api/suscribir (toque 0, al instante) y por
// /api/cron/suscriptores (los toques 2, 5, 9 y 14). Sin acceso a BD ni a env:
// aquí sólo vive el calendario y las reglas del correo.
//
// DOS CARRILES, a propósito:
//   suscriptor = dejó SÓLO su correo por la guía. No pidió que le hablen.
//   lead       = dejó nombre + WhatsApp. Sí pidió que le hablen (ver /api/leads).
// Mezclarlos rompía el CRM: el digest diario reportaría decenas de seguimientos
// vencidos que nadie iba a atender, y el digest dejaría de leerse.

/** Los toques de la secuencia, en orden. `dia` = días desde que se suscribió. */
export const TOQUES_GUIA = [
  { tipo: "guia_0", dia: 0 },
  { tipo: "guia_2", dia: 2 },
  { tipo: "guia_5", dia: 5 },
  { tipo: "guia_9", dia: 9 },
  { tipo: "guia_14", dia: 14 },
] as const;

export type ToqueGuia = (typeof TOQUES_GUIA)[number]["tipo"];

/** Los que manda el cron (el 0 sale al instante desde /api/suscribir). */
export const TOQUES_CRON = TOQUES_GUIA.filter((t) => t.dia > 0);

/**
 * Ventana de tolerancia en días. Si el cron no corrió un día (Vercel se saltó
 * la ejecución, la llave del correo faltaba), el toque no se pierde: se manda
 * al día siguiente. Cerrada por arriba para que alguien que se suscribió hace
 * un mes no reciba los cinco correos de golpe.
 */
export const TOLERANCIA_DIAS = 2;

/**
 * Nadie que se suscribió hace más de esto entra a la secuencia. Es el seguro
 * del día que se encienda el cron: sin él, el primer arranque le escribiría a
 * toda la lista histórica de una sentada.
 */
export const MAX_ANTIGUEDAD_DIAS = 30;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

/** Link de baja de un clic. Va en el pie de CADA correo de la secuencia. */
export function urlBaja(token: string): string {
  return `${SITE}/baja?t=${encodeURIComponent(token)}`;
}

/**
 * Cabeceras que hacen que Gmail y Outlook pinten su propio botón "Cancelar
 * suscripción" arriba del correo.
 *
 * No es cosmético y no es opcional: Kora manda desde el MISMO dominio por el
 * que salen las confirmaciones de reserva de los hoteles clientes. Si alguien
 * no encuentra cómo darse de baja, marca spam — y el castigo cae sobre el
 * dominio entero, no sobre este correo. La confirmación de reserva de un hotel
 * cliente empezaría a caer en spam por culpa de la lista de marketing.
 *
 * `List-Unsubscribe-Post` es el RFC 8058: el cliente de correo manda un POST a
 * la URL sin abrir el navegador. Por eso /api/baja acepta POST.
 */
export function cabecerasBaja(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${SITE}/api/baja?t=${encodeURIComponent(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Normaliza el correo antes de guardarlo (el UNIQUE de la tabla es exacto). */
export function normalizarEmail(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase().slice(0, 160) : "";
}

/** Validación mínima. No intenta ser un RFC: filtra dedazos y basura de bots. */
export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
}

/** Primer nombre, o un saludo neutro. La lista casi siempre viene sin nombre. */
export function primerNombre(nombre: string | null | undefined): string {
  return (nombre || "").trim().split(/\s+/)[0] || "hotelero";
}
