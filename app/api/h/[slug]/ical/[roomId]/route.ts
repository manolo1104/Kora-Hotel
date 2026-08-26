import { leer } from "@/lib/db/result";
// Export iCal PÚBLICO por cuarto (multi-tenant). Portado de
// mi-hotel/app/api/ical/[roomId] pero generalizado: el hotel se resuelve por
// slug (sin auth) y los bloqueos se leen de la tabla `blocks` (no de Sheets).
//
// Para qué sirve: pegas esta URL en el Extranet de Booking/Expedia → ellos
// importan periódicamente la disponibilidad de Kora (reservas, bloqueos
// manuales, mantenimiento y bloqueos venidos de OTRAS OTAs) y cierran esas
// fechas en su lado. Así Kora es la fuente de verdad de la disponibilidad.
//
// roomId puede llegar como:
//   - el NOMBRE del cuarto url-encoded ("Suite%20Jungla"), o
//   - un índice numérico (0..n-1) contra tipoNamesOf(hotel).
// Se resuelve SIEMPRE contra los cuartos reales del hotel (404 si no coincide).

import { NextRequest, NextResponse } from "next/server";
import { resolveHotel } from "@/lib/tenant";
import { tipoNamesOf } from "@/lib/booking";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Estados de `blocks` que ocupan el cuarto de cara a las OTAs. HOLD (carrito sin
// pagar) se EXCLUYE a propósito: no queremos cerrar fechas por holds efímeros.
const OCCUPYING_STATUSES = ["RESERVADO", "BLOQUEADO", "OTA", "MANTENIMIENTO"];

function icalDate(dateStr: string): string {
  // 'YYYY-MM-DD' → 'YYYYMMDD' (formato DATE de iCal).
  return dateStr.replace(/-/g, "");
}

function escapeIcal(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

interface BlockRow {
  id: string;
  checkin: string;
  checkout: string;
  status: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; roomId: string }> },
) {
  const { slug, roomId } = await params;

  const hotel = await resolveHotel(slug);
  if (!hotel) return new NextResponse("Hotel not found", { status: 404 });

  const rooms = tipoNamesOf(hotel);
  if (rooms.length === 0) return new NextResponse("Room not found", { status: 404 });

  // Resolver roomId → nombre del cuarto.
  const decoded = decodeURIComponent(roomId).trim();
  let roomName: string | undefined;
  if (/^\d+$/.test(decoded)) {
    // Índice numérico.
    const idx = parseInt(decoded, 10);
    roomName = rooms[idx];
  }
  if (!roomName) {
    // Match por nombre (exacto, luego case-insensitive).
    roomName =
      rooms.find((r) => r === decoded) ??
      rooms.find((r) => r.toLowerCase() === decoded.toLowerCase());
  }
  if (!roomName) return new NextResponse("Room not found", { status: 404 });

  // Bloqueos vigentes (checkout > hoy) del cuarto en este hotel.
  const supabase = createAdminClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  // LANZA si falla, y eso es exactamente lo que se quiere. Antes el error se
  // registraba y se seguía con `data ?? []`: el feed salía VACÍO y con 200, así
  // que Booking y Expedia leían "este cuarto está libre todos los días" y lo
  // ponían a la venta entero. Con un 500, la OTA conserva el último calendario
  // que sí pudo leer.
  const blocks = ((await leer<BlockRow[]>(
    "ical.blocks",
    supabase
      .from("blocks")
      .select("id, checkin, checkout, status")
      .eq("hotel_id", hotel.id)
      .eq("habitacion", roomName)
      .in("status", OCCUPYING_STATUSES)
      .gt("checkout", today),
  )) ?? []) as BlockRow[];

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kora//Channel Manager//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(roomName)} - ${escapeIcal(hotel.nombre)}`,
    "X-WR-TIMEZONE:America/Mexico_City",
  ];

  for (const b of blocks) {
    if (!b.checkin || !b.checkout) continue;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${b.id}-${slug}@kora-hotel.com`);
    lines.push(`DTSTART;VALUE=DATE:${icalDate(b.checkin)}`);
    lines.push(`DTEND;VALUE=DATE:${icalDate(b.checkout)}`);
    lines.push("SUMMARY:No disponible");
    lines.push("STATUS:CONFIRMED");
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
