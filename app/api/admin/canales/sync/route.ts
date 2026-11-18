import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
// «Sincronizar ahora» desde el panel: AUTENTICADA y acotada al hotel activo
// (getActiveHotel). A diferencia del cron global (/api/cron/ical-sync,
// protegido por CRON_SECRET), aquí NO se usa ningún secreto en el navegador.
// La lógica es la misma: `lib/canales/ical.ts`.

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { sincronizarHotel } from "@/lib/canales/ical";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  return rutaSegura("admin.canales.sync.post", async () => {
    const ctx = await getActiveHotel();
    if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
    const no = negar(ctx, "canales:escribir");
    if (no) return no;

    const results = await sincronizarHotel(ctx.hotelId);
    return NextResponse.json({
      synced: results.filter((r) => !r.error).length,
      blocks: results.reduce((n, r) => n + r.bloqueos, 0),
      choques: results.reduce((n, r) => n + r.choques, 0),
      total: results.length,
      errores: results.filter((r) => r.error).map((r) => ({ id: r.id, error: r.error })),
    });
  });
}
