// Arma el "conocimiento" de Camila para UN hotel a partir de su fila. Fuente
// ÚNICA que usan /api/agent (bot vivo) y /api/admin/bot-preview (chat de prueba),
// para que ambos vean exactamente lo mismo. SOLO servidor.

import { hotelRooms, getRoomBasePrice, formatMXN, bookingRules, temporadasDe } from "@/lib/booking";
import { normalizeFaqs, type BotKnowledge } from "@/lib/bot/prompt";
import type { HotelRow } from "@/lib/tenant";
import type { Addon, Experiencia, ExperienciasBundle } from "@/lib/mini";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com").replace(/\/$/, "");

export function buildHotelKnowledge(hotel: HotelRow): BotKnowledge {
  const cfg = (hotel.config ?? {}) as Record<string, unknown>;
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  const bot = (extras.bot ?? {}) as Record<string, unknown>;
  const pago = (bot.pago ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const rooms = hotelRooms(hotel);

  // Experiencias y add-ons vendibles (extras.experiencias / extras.addons).
  // FIX de venta perdida: se configuran en el panel y se venden en el motor,
  // pero Camila no los conocía y jamás los ofrecía.
  const experiencias = (Array.isArray(extras.experiencias) ? (extras.experiencias as Experiencia[]) : [])
    .filter((e) => e && typeof e.nombre === "string" && e.nombre.trim() && Number.isFinite(Number(e.precio)))
    .map((e) => ({
      nombre: e.nombre.trim(),
      precio: Number(e.precio),
      precioTexto: formatMXN(Number(e.precio)),
      cobro: e.cobro ?? "estancia",
      descripcion: str(e.descripcion),
      categoria: str(e.categoria),
      dias: Array.isArray(e.dias) ? e.dias : undefined,
      horarios: Array.isArray(e.horarios) ? e.horarios.filter((h) => typeof h === "string" && h.trim()) : undefined,
      cupoDia: Number.isFinite(Number(e.cupoDia)) && Number(e.cupoDia) > 0 ? Number(e.cupoDia) : undefined,
    }));
  const addons = (Array.isArray(extras.addons) ? (extras.addons as Addon[]) : [])
    .filter((a) => a && typeof a.nombre === "string" && a.nombre.trim() && Number.isFinite(Number(a.precio)))
    .map((a) => ({
      nombre: a.nombre.trim(),
      precio: Number(a.precio),
      precioTexto: formatMXN(Number(a.precio)),
      tipo: a.tipo ?? "estancia",
    }));
  const bundleRaw = (extras.experienciasBundle ?? {}) as ExperienciasBundle;
  const bundle =
    Number(bundleRaw.pct) > 0
      ? { min: Math.max(2, Number(bundleRaw.min) || 2), pct: Number(bundleRaw.pct) }
      : undefined;

  // Reglas de reserva y temporadas: el motor SIEMPRE las aplica al cobrar
  // (lib/booking); aquí se las damos a Camila para que las pueda EXPLICAR
  // ("¿cuánto es el anticipo?", "¿hasta cuándo cancelo gratis?", "¿por qué
  // sube el precio en diciembre?") en vez de quedarse callada.
  const reglas = bookingRules(hotel);
  const temporadas = temporadasDe(hotel).map((t) => ({
    nombre: t.nombre,
    desde: t.desde,
    hasta: t.hasta,
    ajuste: t.ajuste,
    minNoches: t.minNoches,
  }));

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
    experiencias,
    addons,
    experienciasBundle: bundle,
    reglas: {
      anticipoPct: reglas.anticipoPct,
      anticipoMinNoches: reglas.anticipoMinNoches,
      minNoches: reglas.minNoches,
      nrfActiva: reglas.nrfActiva,
      nrfPct: reglas.nrfPct,
      cancelacionDias: reglas.cancelacionDias,
      pagoEnHotel: reglas.pagoEnHotel,
      ishPct: reglas.ishPct,
    },
    temporadas,
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
