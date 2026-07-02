import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { checkAvailability } from '@/lib/db/availability';

export const dynamic = 'force-dynamic';

// Chequeo de disponibilidad EN VIVO para el ReservationModal del panel. El hotel
// se resuelve por cookie/sesión, nunca del body. Devuelve la misma forma que
// esperaba el modal: { available, unavailableRooms }.
export async function POST(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { checkin, checkout, rooms } = await req.json();
  const roomNames = Array.isArray(rooms)
    ? rooms.map((r: string) => String(r).replace(/\s*\([^)]*\)/g, '').trim()).filter(Boolean)
    : [];

  const result = await checkAvailability(ctx.hotelId, checkin, checkout, roomNames);
  return NextResponse.json(result);
}
