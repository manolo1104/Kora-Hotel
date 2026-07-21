// Arma el "conocimiento" de Camila para UN hotel a partir de su fila. Fuente
// ÚNICA que usan /api/agent (bot vivo) y /api/admin/bot-preview (chat de prueba),
// para que ambos vean exactamente lo mismo. SOLO servidor.

import { hotelRooms, getRoomBasePrice, formatMXN } from "@/lib/booking";
import { normalizeFaqs, type BotKnowledge } from "@/lib/bot/prompt";
import type { HotelRow } from "@/lib/tenant";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com").replace(/\/$/, "");

export function buildHotelKnowledge(hotel: HotelRow): BotKnowledge {
  const cfg = (hotel.config ?? {}) as Record<string, unknown>;
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  const bot = (extras.bot ?? {}) as Record<string, unknown>;
  const pago = (bot.pago ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const rooms = hotelRooms(hotel);

  return {
    nombre: hotel.nombre,
    ubicacion: hotel.ubicacion,
    descripcion: hotel.descripcion,
    whatsapp: hotel.whatsapp,
    habitaciones: rooms.map((r) => ({
      nombre: r.name,
      descripcion: r.description ?? "",
      desde: getRoomBasePrice(r, 2),
      desdeTexto: formatMXN(getRoomBasePrice(r, 2)),
      maxHuespedes: r.maxGuests,
      camas: Array.isArray(r.camas) ? r.camas.map((c) => `${c.cantidad} ${c.tipo}`) : [],
      caracteristicas: Array.isArray(r.features) ? r.features : [],
    })),
    amenidades: (extras.amenidades as string[]) ?? [],
    // FIX: mezcla las FAQs del panel ({pregunta,respuesta}) + las solo-del-bot
    // (extras.bot.faqs {q,a}), normalizadas. Antes no llegaban al cerebro.
    faqs: normalizeFaqs(extras.faqs, bot.faqs),
    politicas: (extras.politicas as Record<string, unknown>) ?? {},
    guia: (hotel.guia as Record<string, unknown>) ?? {},
    bot: {
      nombre: str(bot.nombre),
      tono: str(bot.tono),
      saludo: str(bot.saludo),
      instrucciones: str(bot.instrucciones),
      escalarWhatsapp: str(bot.escalarWhatsapp),
      pago: {
        titular: str(pago.titular),
        banco: str(pago.banco),
        clabe: str(pago.clabe),
        cuenta: str(pago.cuenta),
        notas: str(pago.notas),
      },
    },
    lang: cfg.bot_lang === "en" ? "en" : "es",
    slug: hotel.slug,
    reservaUrl: `${SITE}/h/${hotel.slug}/reservar`,
  };
}
