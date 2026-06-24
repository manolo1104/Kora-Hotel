import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";

export const dynamic = "force-dynamic";

// Enviar oferta de regreso a un huésped. La plantilla y el envío se cablean en la
// Fase 6 (secuencias de email por hotel). Por ahora responde con gracia.
export async function POST() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  return NextResponse.json({ ok: false, error: "El envío de ofertas estará disponible muy pronto." });
}
