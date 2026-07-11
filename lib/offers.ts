// Redacción con IA de ofertas de regreso personalizadas (CRM de clientes).
// SOLO servidor. Separado del route handler para poder probar la redacción sin
// pasar por la capa HTTP/auth. El envío del correo lo hace el route con Resend.

import Anthropic from "@anthropic-ai/sdk";
import type { HotelBrand } from "@/lib/email-sequences";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 900;

export interface OfferGuest {
  nombre: string;
  totalReservas: number;
  ultimaEstancia?: string;
  suitesFavoritas?: string[];
  notas?: string;
}

export interface OfferDraft {
  subject: string;
  paragraphs: string[];
}

export const firstName = (n: string) => (n || "").trim().split(" ")[0] || "huésped";

/**
 * Pide a la IA el cuerpo de un correo de "vuelve a visitarnos" personalizado.
 * Devuelve asunto + párrafos (texto plano; el route los envuelve en la marca).
 * Lanza si falta la llave, si la IA no responde JSON usable, o si sale vacío.
 */
export async function draftOfferEmail(brand: HotelBrand, guest: OfferGuest): Promise<OfferDraft> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY");

  const nombre = (guest.nombre || "").trim() || "huésped";
  const suites = Array.isArray(guest.suitesFavoritas) ? guest.suitesFavoritas.filter(Boolean) : [];
  const perfil = [
    `Nombre: ${nombre}`,
    `Estancias previas en el hotel: ${guest.totalReservas || 0}`,
    guest.ultimaEstancia ? `Última estancia: ${guest.ultimaEstancia}` : "",
    suites.length ? `Habitaciones que ha reservado: ${suites.join(", ")}` : "",
    guest.notas ? `Notas internas del hotel sobre este huésped: ${guest.notas}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const promoLine = brand.promoCode
    ? `El hotel tiene una promo activa (código "${brand.promoCode}", ${brand.promoDiscount} de descuento). Invítalo a usarla con naturalidad, pero NO escribas el código tú (aparece en un recuadro aparte).`
    : `El hotel NO tiene ningún código de descuento configurado: NO inventes descuentos, precios ni códigos. Enfócate en una invitación cálida y sincera a regresar.`;

  const sys = `Eres el/la anfitrión(a) de "${brand.nombre || "el hotel"}", un hotel boutique en México. Escribes un correo BREVE y cálido para invitar a un huésped anterior a regresar. Tono cercano, humano y elegante; nada corporativo ni exagerado. Español de México, de "tú".`;
  const userMsg = `Redacta el CUERPO de un correo de "vuelve a visitarnos" para este huésped:

${perfil}

${promoLine}

Reglas:
- 2 a 3 párrafos cortos. SIN saludo inicial (el "Hola, ${firstName(nombre)}" se agrega aparte) y SIN despedida/firma (el pie ya va aparte).
- Personaliza con lo que sabes (su habitación favorita, que ya vino ${(guest.totalReservas || 0) > 1 ? "varias veces" : "antes"}), pero sin sonar vigilado ni listar datos como robot.
- NO inventes hechos, fechas, precios ni descuentos que no te di.
- Devuelve SOLO JSON válido, sin nada más, con esta forma exacta:
{"subject":"<asunto corto y personal>","paragraphs":["<párrafo 1>","<párrafo 2>"]}`;

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: sys,
    messages: [{ role: "user", content: userMsg }],
  });
  const text = msg.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La IA no devolvió JSON");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { subject?: unknown; paragraphs?: unknown };
  const subject = String(parsed.subject ?? "").trim() || `${firstName(nombre)}, algo especial de ${brand.nombre || "tu hotel"}`;
  const paragraphs = Array.isArray(parsed.paragraphs)
    ? parsed.paragraphs.map((p) => String(p).trim()).filter(Boolean).slice(0, 4)
    : [];
  if (!paragraphs.length) throw new Error("La IA devolvió un correo vacío");
  return { subject, paragraphs };
}
