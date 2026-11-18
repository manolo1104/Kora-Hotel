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
// Es por UNIDAD FÍSICA ("Cabaña 2"), no por tipo (K-22): con dos cabañas
// iguales, cada anuncio de Airbnb/Booking lee SOLO su cabaña. Antes se
// resolvía contra `tipoNamesOf` y el feed sólo veía la primera unidad.
//
// roomId puede llegar como:
//   - el NOMBRE de la unidad url-encoded ("Cabaña%202"). Las URLs ya pegadas
//     con el nombre del TIPO siguen sirviendo: la 1ª unidad se llama igual.
//   - un índice numérico (0..n-1) contra unitNamesOf(hotel).

import { NextRequest, NextResponse } from "next/server";
import { resolveHotel } from "@/lib/tenant";
import { unitNamesOf } from "@/lib/booking";
import { generarFeed } from "@/lib/canales/ical";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Estados de `blocks` que ocupan el cuarto de cara a las OTAs. HOLD (carrito sin
// pagar) se EXCLUYE a propósito: no queremos cerrar fechas por holds efímeros.
const OCCUPYING_STATUSES = ["RESERVADO", "BLOQUEADO", "OTA", "MANTENIMIENTO"];

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

  const rooms = unitNamesOf(hotel);
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

  const feed = generarFeed({ slug, hotelNombre: hotel.nombre, unidad: roomName, bloques: blocks });

  return new NextResponse(feed, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
