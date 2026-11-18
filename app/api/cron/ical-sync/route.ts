// Cron GLOBAL del enlace por iCal (Airbnb, Booking, Expedia/Vrbo, otros).
// Corre cada 15 minutos (vercel.json) — antes era 1 vez al día, y una reserva
// de Airbnb podía tardar hasta 24 h en cerrar la unidad en Kora.
//
//  - Protegido por Authorization: Bearer CRON_SECRET.
//  - La lógica vive en `lib/canales/ical.ts` (la misma que usa el botón
//    «Sincronizar ahora» del panel, vía /api/admin/canales/sync, con la sesión
//    del hotelero y acotada a SU hotel — nunca con este secreto).
//  - Los errores son POR CANAL: un iCal caído marca ese canal en 'error', no
//    borra sus bloqueos y la corrida sigue con el resto.

import { NextRequest, NextResponse } from "next/server";
import { limpiarHoldsVencidos } from "@/lib/db/availability";
import { sincronizarTodos } from "@/lib/canales/ical";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Barrido de apartados vencidos (K-265). Va aquí y no en un cron propio para
  // no gastar otro cron. No corta la corrida si falla — limpiar es higiene,
  // sincronizar es el trabajo.
  const holdsBorrados = await limpiarHoldsVencidos();
  if (holdsBorrados) console.log(`[cron/ical-sync] apartados vencidos borrados: ${holdsBorrados}`);

  try {
    const results = await sincronizarTodos();
    return NextResponse.json({
      synced: results.filter((r) => !r.error).length,
      errores: results.filter((r) => r.error).length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("ical-sync:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "db-error" }, { status: 500 });
  }
}
