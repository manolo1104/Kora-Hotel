// Canales OTA del hotel activo. Portado de mi-hotel/app/api/admin/canales.
// El hotel sale de getActiveHotel() (cookie kora_active_slug + sesión); el
// hotelId NUNCA viene del body. saveOTACalendar recibe hotelId primero.

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getAllOTACalendars, saveOTACalendar } from "@/lib/db/admin";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const calendars = await getAllOTACalendars(ctx.hotelId);
  return NextResponse.json(calendars);
}

export async function POST(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const body = await req.json();
  const { roomName, platform, icalUrl, active = true, id } = body;
  if (!roomName || !platform || !icalUrl) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  await saveOTACalendar(ctx.hotelId, {
    id: id || randomUUID(),
    roomName,
    platform,
    icalUrl,
    active,
  });
  return NextResponse.json({ ok: true });
}
