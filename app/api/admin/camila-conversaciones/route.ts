import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getHilosCamila, getHiloCamila } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

// Las conversaciones de Camila con los huéspedes, para el panel del hotelero.
//
// La tabla se llenaba desde hace semanas y no había una sola función que la
// leyera, mientras la página de venta prometía que «todas las conversaciones
// quedan en tu panel y puedes leerlas». Ésta es la puerta que faltaba.
//
// El hotel sale de la SESIÓN (`getActiveHotel`), nunca del cuerpo ni de la
// query: pedir el hilo de otro hotel no es posible aunque se adivine el
// teléfono, porque el `hotel_id` del filtro no lo elige quien pregunta.
//
// Permiso `bot:leer` (de mando): quien puede entrenar a Camila puede leer lo que
// contestó. Son mensajes de huéspedes, así que no baja de ahí.

export async function GET(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:leer");
  if (no) return no;

  const chatId = new URL(req.url).searchParams.get("chat");
  if (chatId) {
    const hilo = await getHiloCamila(ctx.hotelId, chatId);
    if (!hilo) return NextResponse.json({ error: "no-encontrado" }, { status: 404 });
    return NextResponse.json({ hilo });
  }

  const hilos = await getHilosCamila(ctx.hotelId);
  return NextResponse.json({ hilos });
}
