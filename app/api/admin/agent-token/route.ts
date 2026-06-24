// Token del bot WhatsApp por hotel. El dueño lo obtiene aquí (se genera la
// primera vez y se guarda en hoteles.config.agent_token) para configurar su bot.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const cfg = (ctx.hotel.config ?? {}) as Record<string, unknown>;
  let token = cfg.agent_token as string | undefined;

  if (!token) {
    if (ctx.rol !== "dueno") {
      return NextResponse.json({ error: "Solo el dueño puede generar el token del bot." }, { status: 403 });
    }
    token = `kora_${randomUUID().replace(/-/g, "")}`;
    const admin = createAdminClient();
    await admin
      .from("hoteles")
      .update({ config: { ...cfg, agent_token: token } })
      .eq("id", ctx.hotelId);
  }

  return NextResponse.json({ token, endpoint: "/api/agent" });
}
