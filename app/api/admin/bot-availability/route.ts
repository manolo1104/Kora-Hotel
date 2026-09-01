import { negar } from "@/lib/panel/permisos";
// Verificador de disponibilidad del panel: dadas unas fechas, devuelve EXACTAMENTE
// lo que Camila ofrecería (mismos cuartos y precios), reusando botAvailability —
// la misma función que consume el bot vivo y el chat de prueba. Sin IA, determinista.
// Sirve para que el hotelero confirme con sus ojos qué fechas/precios cotiza Camila.

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { botAvailability } from "@/lib/bot/tools";
import { zFecha } from "@/lib/api/cuerpo";
import { z } from "zod";
import { leerCuerpo } from "@/lib/api/cuerpo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


const CONSULTA_SCHEMA = z.object({
  checkin: zFecha,
  checkout: zFecha,
});

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:leer");
  if (no) return no;

  const c = await leerCuerpo(req, CONSULTA_SCHEMA);
  if (!c.ok) return c.respuesta;
  const { checkin, checkout } = c.datos;
  // El formato lo comprueba `zFecha`; aquí sólo queda el orden.
  if (checkout <= checkin) {
    return NextResponse.json({ error: "fechas-invalidas" }, { status: 400 });
  }

  try {
    const disp = await botAvailability(ctx.hotel, checkin, checkout);
    return NextResponse.json({ ok: true, ...disp });
  } catch (e) {
    console.error("bot-availability error:", e);
    return NextResponse.json({ ok: false, error: "servicio-no-disponible" }, { status: 502 });
  }
}
