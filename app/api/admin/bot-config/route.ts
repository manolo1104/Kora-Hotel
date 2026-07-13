// Configuración + entrenamiento de Camila para el hotel de la cuenta activa.
// GET: estado (on/off, idioma), entrenamiento actual (extras.bot) y un resumen de
// "lo que Camila ya sabe" (sacado ESTRICTAMENTE de los datos de este hotel).
// POST: guarda on/off, idioma y entrenamiento. Auth por getActiveHotel().

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { saveBotConfig, type BotTrainingInput } from "@/lib/db/admin";
import { hotelRooms } from "@/lib/booking";
import { normalizeFaqs } from "@/lib/bot/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max = 4000) =>
  typeof v === "string" ? v.trim().slice(0, max) : undefined;

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const hotel = ctx.hotel;
  const cfg = (hotel.config ?? {}) as Record<string, unknown>;
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  const bot = (extras.bot ?? {}) as Record<string, unknown>;
  const rooms = hotelRooms(hotel);

  return NextResponse.json({
    enabled: cfg.bot_enabled === undefined ? true : cfg.bot_enabled !== false,
    lang: cfg.bot_lang === "en" ? "en" : "es",
    whatsapp: hotel.whatsapp, // default para "escalar a humano"
    bot: {
      nombre: str(bot.nombre) ?? "",
      tono: str(bot.tono) ?? "",
      saludo: str(bot.saludo) ?? "",
      instrucciones: str(bot.instrucciones) ?? "",
      escalarWhatsapp: str(bot.escalarWhatsapp) ?? "",
      faqs: normalizeFaqs(bot.faqs),
      entrenadoAt: str(bot.entrenadoAt) ?? null,
    },
    // Lo que Camila ya sabe, de los datos REALES de este hotel.
    conocimiento: {
      descripcion: hotel.descripcion ?? "",
      cuartos: rooms.map((r) => ({ nombre: r.name, maxHuespedes: r.maxGuests })),
      amenidades: (extras.amenidades as string[]) ?? [],
      faqs: normalizeFaqs(extras.faqs), // FAQs reales del panel (ya normalizadas)
      politicas: (extras.politicas as Record<string, unknown>) ?? {},
      guia: (hotel.guia as Record<string, unknown>) ?? {},
    },
  });
}

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const input: { enabled?: boolean; lang?: "es" | "en"; bot?: BotTrainingInput } = {};
  if (typeof body.enabled === "boolean") input.enabled = body.enabled;
  if (body.lang === "es" || body.lang === "en") input.lang = body.lang;

  if (body.bot && typeof body.bot === "object") {
    const b = body.bot as Record<string, unknown>;
    const faqs = Array.isArray(b.faqs)
      ? normalizeFaqs(b.faqs)
          .slice(0, 30) // tope sano
          .map((f) => ({ q: f.q, a: f.a ?? "" }))
      : undefined;
    input.bot = {
      nombre: str(b.nombre, 60),
      tono: str(b.tono, 2000),
      saludo: str(b.saludo, 600),
      instrucciones: str(b.instrucciones, 4000),
      escalarWhatsapp: str(b.escalarWhatsapp, 40),
      ...(faqs ? { faqs } : {}),
    };
  }

  await saveBotConfig(ctx.hotelId, input);
  return NextResponse.json({ ok: true });
}
