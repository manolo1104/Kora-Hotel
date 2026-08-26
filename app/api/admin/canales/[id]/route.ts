import { rutaSegura } from "@/lib/api/responder";
// Borra un canal OTA del hotel activo. Portado de
// mi-hotel/app/api/admin/canales/[id]. deleteOTACalendar(hotelId, id) ya filtra
// por hotel_id, así que un id de otro hotel no borra nada.

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { deleteOTACalendar } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return rutaSegura("admin.canales.id.delete", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const { id } = await params;
  await deleteOTACalendar(ctx.hotelId, id);
  return NextResponse.json({ ok: true });
  });
}
