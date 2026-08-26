import { negar } from "@/lib/panel/permisos";
// Verificador de disponibilidad del panel: dadas unas fechas, devuelve EXACTAMENTE
// lo que Camila ofrecería (mismos cuartos y precios), reusando botAvailability —
// la misma función que consume el bot vivo y el chat de prueba. Sin IA, determinista.
// Sirve para que el hotelero confirme con sus ojos qué fechas/precios cotiza Camila.

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { botAvailability } from "@/lib/bot/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:leer");
  if (no) return no;

  let body: { checkin?: unknown; checkout?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }

  const checkin = typeof body.checkin === "string" ? body.checkin : "";
  const checkout = typeof body.checkout === "string" ? body.checkout : "";
  if (!ISO.test(checkin) || !ISO.test(checkout) || checkout <= checkin) {
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
