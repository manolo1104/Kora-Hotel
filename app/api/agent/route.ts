// API del BOT WhatsApp por hotel (multi-tenant). Un bot externo (whatsapp-web.js
// en Railway, un número por hotel) consulta aquí con el TOKEN del hotel para
// responder a los huéspedes con datos reales: conocimiento del hotel y
// disponibilidad. El token identifica al hotel (config.agent_token); sin token
// válido → 401. NO requiere sesión de usuario (lo llama un servidor, no un navegador).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hotelRooms,
  roomNamesOf,
  nightOpts,
  calcRoomStayTotal,
  getRoomBasePrice,
  formatMXN,
} from "@/lib/booking";
import { checkAvailability } from "@/lib/db/availability";
import { logAgentActivity } from "@/lib/db/admin";
import { accesoDelHotel } from "@/lib/suscripcion";
import { crearLinkReservaAgente } from "@/lib/agent-booking";
import type { HotelRow } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function hotelPorToken(token: string): Promise<HotelRow | null> {
  if (!token) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("hoteles")
    .select(
      "id, owner_id, slug, nombre, ubicacion, descripcion, whatsapp, habitaciones, fotos, guia, extras, config, prefijo_confirmacion, stripe_account_id, publicado, created_at",
    )
    .eq("config->>agent_token", token)
    .maybeSingle();
  return (data as HotelRow) ?? null;
}

export async function POST(req: Request) {
  let body: {
    token?: string;
    action?: string;
    checkin?: string;
    checkout?: string;
    conv?: string; // id de la conversación (teléfono/chat) para métricas sin doble conteo
    // Campos de la acción "reservar" (el bot cierra la reserva):
    cuarto?: string | number; // id del tipo o su nombre
    unidades?: number; // cuántas unidades del tipo
    huespedes?: number; // adultos
    ninos?: number; // menores
    nombre?: string;
    email?: string;
    telefono?: string;
    lang?: "es" | "en";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const hotel = await hotelPorToken(body.token ?? "");
  if (!hotel) return NextResponse.json({ error: "token-invalido" }, { status: 401 });

  // Métricas del foso (dashboard "Agentes"): cada consulta del bot cuenta. Si
  // el bot manda `conv`, se dedupe por día → conversaciones reales; sin conv se
  // registra la consulta tal cual. Fail-safe: nunca afecta la respuesta al bot.
  const conv = typeof body.conv === "string" && body.conv.trim() ? body.conv.trim().slice(0, 80) : "";
  const accionDetalle =
    body.action === "availability" ? "availability" : body.action === "reservar" ? "reservar" : "knowledge";
  await logAgentActivity(
    hotel.id,
    "whatsapp_conv",
    conv ? `conv:${conv}` : accionDetalle,
    Boolean(conv),
  );

  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  const rooms = hotelRooms(hotel);

  if (body.action === "availability") {
    const { checkin, checkout } = body;
    if (!checkin || !checkout) {
      return NextResponse.json({ error: "fechas-requeridas" }, { status: 400 });
    }
    const result = await checkAvailability(hotel.id, checkin, checkout, roomNamesOf(hotel));
    const opts = nightOpts(hotel);
    const disponibles = rooms
      .filter((r) => !result.unavailableRooms.includes(r.name))
      .map((r) => ({
        id: r.id, // referencia estable para cerrar la reserva (action:"reservar")
        nombre: r.name,
        maxHuespedes: r.maxGuests,
        total: calcRoomStayTotal(r, r.maxGuests, checkin, checkout, opts),
        totalTexto: formatMXN(calcRoomStayTotal(r, r.maxGuests, checkin, checkout, opts)),
      }));
    return NextResponse.json({
      hotel: hotel.nombre,
      checkin,
      checkout,
      hayDisponibilidad: disponibles.length > 0,
      disponibles,
      linkReserva: `/h/${hotel.slug}/reservar`,
    });
  }

  // Acción "reservar": el bot CIERRA la reserva. Apartamos el cuarto y devolvemos
  // un link de pago de Stripe (direct charge al hotel). El huésped paga en un tap
  // y el webhook existente crea la reserva atómica y manda los correos. La
  // maquinaria pesada (precio, disponibilidad, hold, reserva) se reusa entera; el
  // riesgo de sobreventa es el mismo del motor web (candado atómico).
  if (body.action === "reservar") {
    // Cerradas las puertas que el motor web ya cierra: hotel demo y motor pausado
    // (prueba vencida sin plan) no deben poder cobrar por API.
    if ((hotel.extras as { demo?: boolean } | null)?.demo === true) {
      return NextResponse.json({ ok: false, error: "hotel-demo" }, { status: 403 });
    }
    const acceso = await accesoDelHotel(hotel);
    if (!acceso.activo) {
      return NextResponse.json({ ok: false, error: "motor-pausado" }, { status: 403 });
    }

    const origin = new URL(req.url).origin;
    const resultado = await crearLinkReservaAgente(
      hotel,
      {
        cuarto: body.cuarto ?? null,
        checkin: body.checkin ?? "",
        checkout: body.checkout ?? "",
        unidades: body.unidades,
        huespedes: body.huespedes,
        ninos: body.ninos,
        nombre: body.nombre ?? null,
        email: body.email ?? null,
        telefono: body.telefono ?? null,
        lang: body.lang,
      },
      origin,
    );

    // Métrica del foso: link de pago generado por el bot (la reserva PAGADA se
    // cuenta aparte, por origen:"bot" en el donut de origen de reservas). Sin
    // dedupe: cada intento de reserva cuenta.
    if (resultado.ok) {
      await logAgentActivity(hotel.id, "whatsapp_reserva", resultado.habitacion, false);
    }

    // 200 con ok:false para los errores "de negocio" (fechas, disponibilidad,
    // datos): son respuestas normales que el bot traduce al huésped, no fallos.
    return NextResponse.json(resultado);
  }

  // Por defecto: conocimiento del hotel (para que el bot responda preguntas).
  return NextResponse.json({
    nombre: hotel.nombre,
    ubicacion: hotel.ubicacion,
    descripcion: hotel.descripcion,
    whatsapp: hotel.whatsapp,
    linkReserva: `/h/${hotel.slug}/reservar`,
    habitaciones: rooms.map((r) => ({
      nombre: r.name,
      descripcion: r.description ?? "",
      desde: getRoomBasePrice(r, 2),
      desdeTexto: formatMXN(getRoomBasePrice(r, 2)),
      maxHuespedes: r.maxGuests,
    })),
    amenidades: extras.amenidades ?? [],
    faqs: extras.faqs ?? [],
    politicas: extras.politicas ?? {},
    guia: hotel.guia ?? {},
  });
}
