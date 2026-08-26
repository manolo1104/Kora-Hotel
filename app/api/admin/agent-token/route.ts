import { negar } from "@/lib/panel/permisos";
// Token del bot WhatsApp por hotel. El dueño lo obtiene aquí (se genera la
// primera vez) para configurar su bot. Vive en `hotel_bot_tokens`, tabla que sólo
// ve la service-role: antes se guardaba en `hoteles.config.agent_token`, columna
// legible desde internet con la llave anónima del navegador.
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getBotToken, setBotToken, nuevoBotToken } from "@/lib/db/bot-token";
import { rutaSegura } from "@/lib/api/responder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return rutaSegura("admin.agentToken.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:vincular");
  if (no) return no;

  // El guardián `bot:vincular` de arriba cubre LEER y GENERAR. Antes el rol sólo
  // se miraba al generar: cualquier miembro podía LEER un token ya existente, y
  // con ese token se apaga a Camila, se generan links de pago a nombre del hotel
  // y se le bloquean cuartos reales.
  const existente = await getBotToken(ctx.hotelId);
  if (existente) return NextResponse.json({ token: existente, endpoint: "/api/agent" });

  const token = nuevoBotToken();
  // `setBotToken` LANZA si el guardado falla, y `rutaSegura` lo convierte en 500:
  // si no se comprobara, al dueño se le enseñaría un token que no existe en
  // ninguna parte y su bot nunca conectaría.
  await setBotToken(ctx.hotelId, token);
  return NextResponse.json({ token, endpoint: "/api/agent" });
  });
}
