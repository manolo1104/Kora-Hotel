// Tipos y textos compartidos por las secciones de la pantalla de Camila.

export interface Faq {
  q: string;
  a: string;
}

export type EmojiNivel = "nada" | "bajo" | "medio" | "alto";

export interface BotPago {
  titular: string;
  banco: string;
  clabe: string;
  cuenta: string;
  notas: string;
}

export interface BotConfig {
  nombre: string;
  tono: string;
  saludo: string;
  instrucciones: string;
  escalarWhatsapp: string;
  pago: BotPago;
  emojis: { nivel: EmojiNivel; preferidos: string };
  faqs: Faq[];
  probadoAt: string | null;
  pruebas: number;
}

export interface DatosHotel {
  ubicacion: string;
  checkin: string;
  checkout: string;
  mascotas: string;
  ninos: string;
  formasPago: string[];
  idiomas: string[];
  mapsUrl: string;
}

/** Lo que devuelve `GET /api/admin/saldo`. */
export interface Saldo {
  /** `null` = no hay dato. NO es cero. */
  mensajes: number | null;
  consumo30d: number;
  diasRestantes: number | null;
  umbralBajo: number;
  paquetes: { mxn: number; mensajes: number; destacado?: boolean }[];
  recargaAbierta: boolean;
  bloqueoActivo: boolean;
  puedeRecargar: boolean;
}

export const BOT_VACIO: BotConfig = {
  nombre: "",
  tono: "",
  saludo: "",
  instrucciones: "",
  escalarWhatsapp: "",
  pago: { titular: "", banco: "", clabe: "", cuenta: "", notas: "" },
  emojis: { nivel: "medio", preferidos: "" },
  faqs: [],
  probadoAt: null,
  pruebas: 0,
};

export const DATOS_VACIOS: DatosHotel = {
  ubicacion: "",
  checkin: "",
  checkout: "",
  mascotas: "",
  ninos: "",
  formasPago: [],
  idiomas: [],
  mapsUrl: "",
};

export type Seccion = "resumen" | "personalidad" | "sabe" | "vende" | "conversaciones" | "whatsapp";

/** Los mensajes que el servidor manda por campo, en palabras del hotelero. */
export const MENSAJES_CAMPO: Record<string, string> = {
  "telefono-invalido": "Ese número no parece un WhatsApp: escribe 10 dígitos con lada (p. ej. 481 123 4567).",
  "clabe-invalida": "La CLABE tiene exactamente 18 dígitos.",
  "hora-invalida": "Escribe la hora como 15:00.",
};

/** Sólo dígitos, para comparar teléfonos escritos de distintas formas. */
export const digitos = (s: string) => (s ?? "").replace(/\D/g, "");

/** ¿Es un WhatsApp plausible? 10 dígitos (México) o con 52/521 delante. */
export function telefonoValido(s: string): boolean {
  const d = digitos(s);
  return d.length >= 10 && d.length <= 13;
}

/** ¿Dos teléfonos son el mismo? (últimos 10 dígitos) */
export const mismoTelefono = (a: string, b: string) => {
  const x = digitos(a).slice(-10);
  return x.length === 10 && x === digitos(b).slice(-10);
};
