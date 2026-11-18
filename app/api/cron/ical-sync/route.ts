// Cron GLOBAL del enlace por iCal (Airbnb, Booking, Expedia/Vrbo, otros).
// Corre UNA vez al día (vercel.json): el proyecto está en Vercel Hobby, que
// rechaza el despliegue entero con un cron más frecuente (pasó el 18 nov 2026
// con */15). Es el RESPALDO. La frescura real la da el tráfico:
//   · antes de apartar cualquier reserva (motor y Camila) se leen los
//     calendarios con más de 15 min — `refrescarAntesDeApartar`;
//   · al buscar disponibilidad y al abrir el calendario o Canales del panel,
//     en segundo plano — `refrescarSiHaceFalta`.
// Con Vercel Pro, poner "*/15 * * * *" en vercel.json y listo.
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
