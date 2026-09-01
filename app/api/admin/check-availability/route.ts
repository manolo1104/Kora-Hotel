import { negar } from "@/lib/panel/permisos";
import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { checkAvailability } from '@/lib/db/availability';
import { leerCuerpo, zFecha } from "@/lib/api/cuerpo";
import { z } from "zod";

export const dynamic = 'force-dynamic';

// Chequeo de disponibilidad EN VIVO para el ReservationModal del panel. El hotel
// se resuelve por cookie/sesión, nunca del body. Devuelve la misma forma que
// esperaba el modal: { available, unavailableRooms }.
// El tope de 100 cuartos no es teórico: sin él, una lista de 50.000 nombres
// obliga a recorrer el inventario entero por cada uno.
const CONSULTA_SCHEMA = z.object({
  checkin: zFecha,
  checkout: zFecha,
  rooms: z.array(z.string().max(200)).max(100).default([]),
});

export async function POST(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "reservas:leer");
  if (no) return no;

  const c = await leerCuerpo(req, CONSULTA_SCHEMA);
  if (!c.ok) return c.respuesta;
  // Los nombres llegan como "Suite Jungla (2 pax)": se recorta el paréntesis.
  const roomNames = c.datos.rooms
    .map((r) => r.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean);

  const result = await checkAvailability(ctx.hotelId, c.datos.checkin, c.datos.checkout, roomNames);
  return NextResponse.json(result);
}
