// Token del bot WhatsApp por hotel. El dueño lo obtiene aquí (se genera la
// primera vez) para configurar su bot. Vive en `hotel_bot_tokens`, tabla que sólo
// ve la service-role: antes se guardaba en `hoteles.config.agent_token`, columna
// legible desde internet con la llave anónima del navegador.
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getBotToken, setBotToken, nuevoBotToken } from "@/lib/db/bot-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const existente = await getBotToken(ctx.hotelId);
  if (existente) return NextResponse.json({ token: existente, endpoint: "/api/agent" });

  if (ctx.rol !== "dueno") {
    return NextResponse.json({ error: "Solo el dueño puede generar el token del bot." }, { status: 403 });
  }
  const token = nuevoBotToken();
  // Antes no se comprobaba el resultado: si el guardado fallaba, al dueño se le
  // enseñaba un token que no existía en ninguna parte y su bot nunca conectaba.
  if (!(await setBotToken(ctx.hotelId, token))) {
    return NextResponse.json({ error: "No se pudo guardar el token. Inténtalo de nuevo." }, { status: 500 });
  }
  return NextResponse.json({ token, endpoint: "/api/agent" });
}
