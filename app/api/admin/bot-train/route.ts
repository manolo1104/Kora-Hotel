// Entrena a Camila con IA para el hotel de la cuenta activa. La IA propone
// personalidad/saludo/instrucciones SOLO a partir de los datos de ESE hotel; el
// dueño revisa y ajusta antes de guardar (con /api/admin/bot-config).

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { draftBotTraining } from "@/lib/bot/train";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  try {
    const draft = await draftBotTraining(ctx.hotel);
    return NextResponse.json({ ok: true, draft });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    // Sin llave de IA → 503; cualquier otro fallo de la IA → 502.
    const status = msg.includes("ANTHROPIC_API_KEY") ? 503 : 502;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
