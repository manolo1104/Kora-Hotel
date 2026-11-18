import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
// Borra un canal OTA del hotel activo. Portado de
// mi-hotel/app/api/admin/canales/[id]. deleteOTACalendar(hotelId, id) ya filtra
// por hotel_id, así que un id de otro hotel no borra nada.

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { deleteOTACalendar, getAllOTACalendars } from "@/lib/db/admin";
import { borrarBloqueosOTA } from "@/lib/db/availability";
import { fuenteDe } from "@/lib/canales/ical";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return rutaSegura("admin.canales.id.delete", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "canales:escribir");
  if (no) return no;

  const { id } = await params;
  // Al quitar un canal se quitan también las noches que había cerrado. Antes se
  // quedaban para siempre: la unidad seguía bloqueada por un Airbnb que ya no
  // estaba enlazado.
  const canal = (await getAllOTACalendars(ctx.hotelId)).find((c) => c.id === id);
  if (canal) {
    await borrarBloqueosOTA(ctx.hotelId, canal.roomName, fuenteDe({ id, tipo: canal.platform }));
  }
  await deleteOTACalendar(ctx.hotelId, id);
  return NextResponse.json({ ok: true });
  });
}
